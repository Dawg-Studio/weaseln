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
export class MetadataError extends Error {}

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
// is seen below as the "::1" every numeric check expects.
function normalizeIpv6(address: string): string {
    try {
        return new URL(`http://[${address}]/`).hostname.slice(1, -1);
    } catch {
        return address;
    }
}

// The eight 16-bit groups of a normalized address, so a range like fe80::/10 is
// compared as a number instead of a list of string prefixes.
function ipv6Groups(address: string): number[] {
    const [head, tail] = address.split("::");
    const headGroups = head ? head.split(":") : [];
    const tailGroups = tail ? tail.split(":") : [];
    const fill = Array<string>(8 - headGroups.length - tailGroups.length).fill("0");
    return [...headGroups, ...fill, ...tailGroups].map((group) =>
        Number.parseInt(group, 16),
    );
}

// The two 16-bit groups are an IPv4 address in hex: 7f00:1 is 127.0.0.1.
function ipv4Octets(high: number, low: number): number[] {
    return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isPublicIpv6(address: string): boolean {
    // Adding the gate here rather than at the caller means an input this
    // function cannot parse is refused by it, not by whoever remembered to
    // check first.
    if (isIP(address) !== 6) return false;
    const groups = ipv6Groups(normalizeIpv6(address).toLowerCase());
    if (groups.length !== 8 || groups.some((group) => Number.isNaN(group))) {
        return false;
    }
    const [first, second, third] = groups;

    // ::ffff:0:a.b.c.d is IPv4-translated, used only to reach an IPv4 host.
    const translated =
        groups.slice(0, 4).every((group) => group === 0) &&
        groups[4] === 0xffff &&
        groups[5] === 0;
    if (translated) return false;

    // ::a.b.c.d and ::ffff:a.b.c.d carry an IPv4 address in their last 32 bits,
    // so the IPv4 rule decides. That covers ::, ::1, ::7f00:1 and ::a9fe:a9fe.
    const carriesIpv4 =
        groups.slice(0, 5).every((group) => group === 0) &&
        (groups[5] === 0 || groups[5] === 0xffff);
    if (carriesIpv4) return isPublicIpv4(ipv4Octets(groups[6], groups[7]));

    // 2002::/16 is 6to4: bits 16-47 are the IPv4 address it routes to.
    if (first === 0x2002) return isPublicIpv4(ipv4Octets(second, third));

    // 64:ff9b::/96 is NAT64: bits 96-127 are the IPv4 address it routes to.
    const nat64 =
        first === 0x64 &&
        second === 0xff9b &&
        groups.slice(2, 6).every((group) => group === 0);
    if (nat64) return isPublicIpv4(ipv4Octets(groups[6], groups[7]));

    // 100::/64 is discard-only.
    if (first === 0x100 && groups.slice(1, 4).every((group) => group === 0)) {
        return false;
    }

    if (first >= 0xfe80 && first <= 0xfebf) return false; // fe80::/10 link-local
    if (first >= 0xfc00 && first <= 0xfdff) return false; // fc00::/7 unique local
    if (first >= 0xff00) return false; // ff00::/8 multicast
    return true;
}

/**
 * The SSRF guard: one address in a private, loopback or link-local range
 * refuses the fetch, because a public hostname can point at an internal
 * service.
 */
export function isPublicAddress(address: string): boolean {
    if (isIP(address) === 4) return isPublicIpv4(address.split(".").map(Number));
    return isPublicIpv6(address);
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
        // A body cut off after its headers ends here, not at "end".
        stream.on("aborted", () => {
            finish(new MetadataError(UNREADABLE));
        });
        stream.on("close", () => {
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
        let deadline: ReturnType<typeof setTimeout> | undefined;
        const clearDeadline = () => {
            if (deadline !== undefined) clearTimeout(deadline);
        };
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            clearDeadline();
            request?.destroy();
            reject(error);
        };
        const succeed = (body: string) => {
            if (settled) return;
            settled = true;
            clearDeadline();
            resolve(body);
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
                    succeed,
                    fail,
                );
            },
        );
        const timedOut = () =>
            new MetadataError(
                `The client metadata document did not answer within ${limits.timeoutMs} ms.`,
            );
        // The idle timeout guards a silent peer. The deadline below is the real
        // bound, because an idle timeout resets on every byte a host drips.
        request.setTimeout(limits.timeoutMs, () => fail(timedOut()));
        deadline = setTimeout(() => fail(timedOut()), limits.timeoutMs);
        request.on("error", () => fail(new MetadataError(UNREADABLE)));
        request.end();
    });
}

function validate(clientId: string, body: string): ClientMetadata {
    let raw: unknown;
    try {
        raw = JSON.parse(body);
    } catch {
        throw new MetadataError(
            "The client metadata document is not valid JSON.",
        );
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new MetadataError(
            "The client metadata document is not a JSON object.",
        );
    }
    const doc = raw as Record<string, unknown>;

    // The raw string is deliberate: the spec requires the document's client_id
    // to equal the URL exactly as the client sent it, not its normalized form.
    if (doc.client_id !== clientId) {
        throw new MetadataError(
            "The client metadata document client_id does not match the URL it was fetched from.",
        );
    }
    if (typeof doc.client_name !== "string" || doc.client_name.trim() === "") {
        throw new MetadataError(
            "The client metadata document has no client_name.",
        );
    }
    if (doc.token_endpoint_auth_method !== "none") {
        throw new MetadataError(
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
        throw new MetadataError(
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
