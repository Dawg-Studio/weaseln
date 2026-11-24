import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { ClientRequest } from "node:http";
import { isIP } from "node:net";
import type { Readable } from "node:stream";

import { isAllowedRedirectUri } from "./redirect-uri";

// shortcut: these two bounds are security necessities, not tuned values.
// Confirm before production traffic.
const METADATA_FETCH_TIMEOUT_MS = 5_000;
const METADATA_MAX_BYTES = 64 * 1024;

const UNREADABLE = "The client metadata document could not be read.";

/** A failure the consent page can print as-is. */
class MetadataError extends Error {}

export type ClientMetadata = {
    clientId: string;
    clientName: string;
    redirectUris: string[];
};

export type MetadataTransport = (
    _url: URL,
    _addresses: string[],
    _limits: { timeoutMs: number; maxBytes: number },
) => Promise<string>;

function parseUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

/**
 * The client identifier is the metadata URL itself, so it has to be an absolute
 * https URL naming a document. An opaque id, a URL with credentials or a bare
 * origin is not one.
 */
function asMetadataUrl(value: string): URL | null {
    const url = parseUrl(value);
    if (!url) return null;
    const isDocument =
        url.protocol === "https:" &&
        url.pathname.length > 1 &&
        url.username === "" &&
        url.password === "" &&
        url.hash === "";
    return isDocument ? url : null;
}

export function isClientMetadataUrl(value: string): boolean {
    return asMetadataUrl(value) !== null;
}

function isPublicIpv4(octets: number[]): boolean {
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false;
    return true;
}

// WHATWG URL serializes an IPv6 address into its compressed form, so "0:0:0:0:0:0:0:1"
// is seen below as the "::1" every prefix check expects.
function normalizeIpv6(address: string): string {
    try {
        return new URL(`http://[${address}]/`).hostname.slice(1, -1);
    } catch {
        return address;
    }
}

// ::ffff:127.0.0.1 and ::ffff:7f00:1 are the same address in two spellings.
function mappedIpv4Octets(rest: string): number[] | null {
    if (rest.includes(".")) return rest.split(".").map(Number);
    const groups = rest.split(":");
    if (groups.length !== 2) return null;
    const [high, low] = groups.map((group) => Number.parseInt(group, 16));
    if (!Number.isInteger(high) || !Number.isInteger(low)) return null;
    return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isPublicIpv6(address: string): boolean {
    const normalized = normalizeIpv6(address).toLowerCase();
    if (normalized.startsWith("::ffff:")) {
        const octets = mappedIpv4Octets(normalized.slice("::ffff:".length));
        return octets !== null && isPublicIpv4(octets);
    }
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fe80:")) return false;
    if (/^f[cd]/.test(normalized)) return false;
    return true;
}

/**
 * The SSRF guard: one address in a private, loopback or link-local range
 * refuses the fetch, because a public hostname can point at an internal
 * service.
 */
export function isPublicAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) return isPublicIpv4(address.split(".").map(Number));
    if (family === 6) return isPublicIpv6(address);
    return false;
}

async function resolvePublicAddresses(hostname: string): Promise<string[]> {
    const bare = hostname.replace(/^\[|\]$/g, "");
    let answers: LookupAddress[];
    try {
        answers = await lookup(bare, { all: true });
    } catch {
        throw new MetadataError(UNREADABLE);
    }
    const anyPrivate = answers.some(
        ({ address }) => !isPublicAddress(address),
    );
    if (answers.length === 0 || anyPrivate) {
        throw new MetadataError(
            "The client metadata document host is not a public address.",
        );
    }
    return answers.map(({ address }) => address);
}

type LookupCallback = (
    _error: NodeJS.ErrnoException | null,
    _address: string | LookupAddress[],
    _family?: number,
) => void;

/**
 * The socket's resolver, pinned to the addresses that already passed
 * `isPublicAddress`. The hostname it is asked about is ignored, so a record
 * that changes between the check and the connection cannot redirect the dial
 * into private space.
 */
export function pinnedLookup(allowed: string[]) {
    return (
        _hostname: string,
        options: { all?: boolean },
        callback: LookupCallback,
    ): void => {
        const entries = allowed.map((address) => ({
            address,
            family: isIP(address),
        }));
        const [first] = entries;
        if (!first) {
            callback(
                new MetadataError("No validated address to connect to."),
                "",
                0,
            );
            return;
        }
        if (options.all) {
            callback(null, entries);
            return;
        }
        callback(null, first.address, first.family);
    };
}

/**
 * The response half of the transport: a 3xx is a refusal, never a redirect,
 * and the body is cut off as soon as it passes the byte cap.
 */
export function readMetadataResponse(
    statusCode: number | undefined,
    stream: Readable,
    limits: { maxBytes: number },
): Promise<string> {
    if (statusCode !== 200) {
        stream.destroy();
        return Promise.reject(
            new MetadataError(
                `The client metadata document answered ${statusCode ?? "no status"}.`,
            ),
        );
    }
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const finish = (error: Error | null, body = "") => {
            if (settled) return;
            settled = true;
            if (error) {
                stream.destroy();
                reject(error);
                return;
            }
            resolve(body);
        };
        stream.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limits.maxBytes) {
                finish(new MetadataError("The client metadata document is too large."));
                return;
            }
            chunks.push(chunk);
        });
        stream.on("end", () => {
            finish(null, Buffer.concat(chunks).toString("utf8"));
        });
        stream.on("error", () => {
            finish(new MetadataError(UNREADABLE));
        });
    });
}

function httpsTransport(
    url: URL,
    addresses: string[],
    limits: { timeoutMs: number; maxBytes: number },
): Promise<string> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let request: ClientRequest | undefined;
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            request?.destroy();
            reject(error);
        };

        request = httpsRequest(
            url,
            {
                method: "GET",
                headers: { accept: "application/json" },
                lookup: pinnedLookup(addresses),
            },
            (response) => {
                readMetadataResponse(response.statusCode, response, limits).then(
                    (body) => {
                        if (settled) return;
                        settled = true;
                        resolve(body);
                    },
                    fail,
                );
            },
        );
        request.setTimeout(limits.timeoutMs, () => {
            fail(
                new MetadataError(
                    `The client metadata document did not answer within ${limits.timeoutMs} ms.`,
                ),
            );
        });
        request.on("error", () => fail(new MetadataError(UNREADABLE)));
        request.end();
    });
}

function validate(clientId: string, body: string): ClientMetadata {
    let raw: unknown;
    try {
        raw = JSON.parse(body);
    } catch {
        throw new Error("The client metadata document is not valid JSON.");
    }
    if (typeof raw !== "object" || raw === null) {
        throw new Error("The client metadata document is not a JSON object.");
    }
    const doc = raw as Record<string, unknown>;

    if (doc.client_id !== clientId) {
        throw new Error(
            "The client metadata document client_id does not match the URL it was fetched from.",
        );
    }
    if (typeof doc.client_name !== "string" || doc.client_name.trim() === "") {
        throw new Error("The client metadata document has no client_name.");
    }
    if (doc.token_endpoint_auth_method !== "none") {
        throw new Error(
            'The client metadata document must use token_endpoint_auth_method "none".',
        );
    }
    const redirectUris = Array.isArray(doc.redirect_uris)
        ? doc.redirect_uris.filter(
              (uri): uri is string =>
                  typeof uri === "string" && isAllowedRedirectUri(uri),
          )
        : [];
    if (redirectUris.length === 0) {
        throw new Error(
            "The client metadata document has no usable redirect URI.",
        );
    }

    return { clientId, clientName: doc.client_name, redirectUris };
}

export async function fetchClientMetadata(
    clientId: string,
    transport: MetadataTransport = httpsTransport,
): Promise<ClientMetadata> {
    const url = asMetadataUrl(clientId);
    if (!url) {
        throw new Error("The client ID is not a metadata document URL.");
    }
    const addresses = await resolvePublicAddresses(url.hostname);

    let body: string;
    try {
        body = await transport(url, addresses, {
            timeoutMs: METADATA_FETCH_TIMEOUT_MS,
            maxBytes: METADATA_MAX_BYTES,
        });
    } catch (error) {
        if (error instanceof MetadataError) throw error;
        throw new MetadataError(UNREADABLE);
    }

    return validate(clientId, body);
}
