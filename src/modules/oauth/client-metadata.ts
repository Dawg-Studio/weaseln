import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { isAllowedRedirectUri } from "./redirect-uri";

// shortcut: these two bounds are security necessities, not tuned values.
// Confirm before production traffic.
const METADATA_FETCH_TIMEOUT_MS = 5_000;
const METADATA_MAX_BYTES = 64 * 1024;

export type ClientMetadata = {
    clientId: string;
    clientName: string;
    redirectUris: string[];
};

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

async function assertPublicHost(hostname: string): Promise<void> {
    const bare = hostname.replace(/^\[|\]$/g, "");
    let addresses: { address: string }[];
    try {
        addresses = await lookup(bare, { all: true });
    } catch {
        throw new Error("The client metadata document could not be read.");
    }
    const anyPrivate = addresses.some(
        ({ address }) => !isPublicAddress(address),
    );
    if (addresses.length === 0 || anyPrivate) {
        throw new Error(
            "The client metadata document host is not a public address.",
        );
    }
}

async function readBody(response: Response): Promise<string> {
    if (!response.ok) {
        throw new Error(
            `The client metadata document answered ${response.status}.`,
        );
    }
    let body: string;
    try {
        body = await response.text();
    } catch {
        throw new Error("The client metadata document could not be read.");
    }
    if (Buffer.byteLength(body) > METADATA_MAX_BYTES) {
        throw new Error("The client metadata document is too large.");
    }
    return body;
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
): Promise<ClientMetadata> {
    const url = asMetadataUrl(clientId);
    if (!url) {
        throw new Error("The client ID is not a metadata document URL.");
    }
    await assertPublicHost(url.hostname);

    let response: Response;
    try {
        response = await fetch(clientId, {
            redirect: "error",
            signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
        });
    } catch {
        throw new Error("The client metadata document could not be read.");
    }

    return validate(clientId, await readBody(response));
}
