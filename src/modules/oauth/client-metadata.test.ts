import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { MetadataTransport } from "./client-metadata";

// ponytail: the reader resolves the hostname before fetching, so the resolver
// is mocked too. Otherwise every case would do real DNS.
const { lookupMock, httpsRequestMock } = vi.hoisted(() => ({
    lookupMock: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
    httpsRequestMock: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
    lookup: lookupMock,
    default: { lookup: lookupMock },
}));

// The default transport is driven through a fake request; no socket is opened.
vi.mock("node:https", () => ({
    request: httpsRequestMock,
    default: { request: httpsRequestMock },
}));

import {
    fetchClientMetadata,
    isClientMetadataUrl,
    isPublicAddress,
    pinnedLookup,
    readMetadataResponse,
} from "./client-metadata";

const DOC = {
    client_id: "https://opencode.ai/oauth/opencode/client.json",
    client_name: "opencode",
    application_type: "native",
    redirect_uris: ["http://127.0.0.1/callback", "http://localhost/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
};

const LIMITS = { timeoutMs: 5_000, maxBytes: 64 * 1024 };

function transportReturning(body: string): MetadataTransport {
    return vi.fn(async () => body);
}

describe("isClientMetadataUrl", () => {
    it("accepts an https url with a path", () => {
        expect(isClientMetadataUrl(DOC.client_id)).toBe(true);
    });
    it("refuses http", () => {
        expect(isClientMetadataUrl("http://opencode.ai/oauth/client.json")).toBe(false);
    });
    it("refuses a url with no path", () => {
        expect(isClientMetadataUrl("https://opencode.ai")).toBe(false);
    });
    it("refuses an opaque client id", () => {
        expect(isClientMetadataUrl("j3nzil3ubhjf0803jmc0p2h30udl7627")).toBe(false);
    });
    it("refuses embedded credentials", () => {
        expect(isClientMetadataUrl("https://user:pw@opencode.ai/client.json")).toBe(false);
    });
});

describe("isPublicAddress", () => {
    it("refuses loopback, link-local and private ranges", () => {
        for (const ip of [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "::1",
            "0:0:0:0:0:0:0:1",
            "fd00::1",
            "fe80::1",
            "fe81::1",
            "febf::1",
            "ff02::1",
            "::ffff:127.0.0.1",
            "::ffff:7f00:1",
            "::7f00:1",
            "::a9fe:a9fe",
        ]) {
            expect(isPublicAddress(ip), ip).toBe(false);
        }
    });
    it("accepts a public address", () => {
        expect(isPublicAddress("93.184.216.34")).toBe(true);
        expect(isPublicAddress("64:ff9b::808:808")).toBe(true);
        expect(isPublicAddress("2002:808:808::")).toBe(true);
    });

    it("refuses a range that carries or routes an IPv4 address", () => {
        for (const ip of [
            "::ffff:0:127.0.0.1", // IPv4-translated
            "2002:7f00:1::", // 6to4 around 127.0.0.1
            "64:ff9b::127.0.0.1", // NAT64 around 127.0.0.1
            "100::1", // discard-only
        ]) {
            expect(isPublicAddress(ip), ip).toBe(false);
        }
    });

    it("refuses an address it cannot parse instead of admitting it", () => {
        for (const value of [
            "fe80::zz",
            "2606:2800:220:1:248:1893:25c8",
            "2606:2800::%eth0",
        ]) {
            expect(isPublicAddress(value), value).toBe(false);
        }
    });
});

describe("fetchClientMetadata", () => {
    it("returns the name and redirect uris", async () => {
        const metadata = await fetchClientMetadata(
            DOC.client_id,
            transportReturning(JSON.stringify(DOC)),
        );
        expect(metadata.clientName).toBe("opencode");
        expect(metadata.redirectUris).toEqual(DOC.redirect_uris);
    });

    it("hands the transport only the validated addresses", async () => {
        const transport = transportReturning(JSON.stringify(DOC));
        await fetchClientMetadata(DOC.client_id, transport);
        expect(transport).toHaveBeenCalledWith(
            expect.any(URL),
            ["93.184.216.34"],
            LIMITS,
        );
    });

    it("refuses a document whose client_id does not match the url", async () => {
        const body = JSON.stringify({ ...DOC, client_id: "https://evil.example/client.json" });
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning(body)),
        ).rejects.toThrow(/client_id/);
    });

    it("refuses a document that wants a client secret", async () => {
        const body = JSON.stringify({ ...DOC, token_endpoint_auth_method: "client_secret_post" });
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning(body)),
        ).rejects.toThrow(/none/);
    });

    it("refuses a document with no usable redirect uri", async () => {
        const body = JSON.stringify({ ...DOC, redirect_uris: ["ftp://x/y"] });
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning(body)),
        ).rejects.toThrow(/redirect/i);
    });

    it("refuses a document that is not json", async () => {
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning("<html>nope</html>")),
        ).rejects.toThrow();
    });

    it("refuses json that is not an object", async () => {
        for (const body of ["[]", "null"]) {
            await expect(
                fetchClientMetadata(DOC.client_id, transportReturning(body)),
            ).rejects.toThrow(/JSON object/);
        }
    });

    it("refuses a document with no client_name", async () => {
        const body = JSON.stringify({ ...DOC, client_name: "" });
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning(body)),
        ).rejects.toThrow(/client_name/);
    });

    it("reports a failed fetch instead of throwing a raw network error", async () => {
        const transport: MetadataTransport = vi.fn(async () => {
            throw new Error("ECONNREFUSED");
        });
        await expect(
            fetchClientMetadata(DOC.client_id, transport),
        ).rejects.toThrow(/could not be read/i);
    });

    it("refuses to fetch when the host resolves to a private address", async () => {
        lookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
        const transport = transportReturning(JSON.stringify(DOC));
        await expect(
            fetchClientMetadata(DOC.client_id, transport),
        ).rejects.toThrow(/not a public/i);
        expect(transport).not.toHaveBeenCalled();
    });

    it("refuses to fetch when the host resolves to nothing", async () => {
        lookupMock.mockResolvedValueOnce([]);
        const transport = transportReturning(JSON.stringify(DOC));
        await expect(
            fetchClientMetadata(DOC.client_id, transport),
        ).rejects.toThrow(/not a public/i);
        expect(transport).not.toHaveBeenCalled();
    });

    it("reports a resolver failure instead of a raw DNS error", async () => {
        lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
        await expect(
            fetchClientMetadata(DOC.client_id, transportReturning(JSON.stringify(DOC))),
        ).rejects.toThrow(/could not be read/i);
    });
});

describe("readMetadataResponse", () => {
    it("rejects a non-200 status and follows no redirect", async () => {
        const stream = Readable.from([], { objectMode: false });
        await expect(
            readMetadataResponse(302, stream, LIMITS),
        ).rejects.toThrow(/302/);
    });

    it("returns the body of a 200 response", async () => {
        const stream = Readable.from([Buffer.from('{"ok":true}')], {
            objectMode: false,
        });
        await expect(
            readMetadataResponse(200, stream, LIMITS),
        ).resolves.toBe('{"ok":true}');
    });

    it("aborts mid-stream once the body exceeds the byte cap", async () => {
        const oversized = Buffer.alloc(LIMITS.maxBytes + 1, 0x20);
        const stream = Readable.from([oversized], { objectMode: false });
        await expect(
            readMetadataResponse(200, stream, LIMITS),
        ).rejects.toThrow(/too large/i);
        expect(stream.destroyed).toBe(true);
    });

    it("rejects when the connection closes before the body ends", async () => {
        const stream = new Readable({ read() {} });
        const pending = readMetadataResponse(200, stream, LIMITS);
        stream.emit("close");
        await expect(pending).rejects.toThrow(/could not be read/i);
    });
});

describe("the wall-clock deadline", () => {
    afterEach(() => {
        vi.useRealTimers();
        httpsRequestMock.mockReset();
    });

    it("rejects a peer that never answers and leaves no timer behind", async () => {
        vi.useFakeTimers();
        const fakeRequest = {
            setTimeout: vi.fn(),
            on: vi.fn(),
            end: vi.fn(),
            destroy: vi.fn(),
        };
        httpsRequestMock.mockReturnValue(fakeRequest);

        const assertion = expect(
            fetchClientMetadata(DOC.client_id),
        ).rejects.toThrow(/did not answer within 5000 ms/);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs);
        await assertion;

        expect(fakeRequest.setTimeout).toHaveBeenCalledWith(
            LIMITS.timeoutMs,
            expect.any(Function),
        );
        expect(fakeRequest.destroy).toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("pinnedLookup", () => {
    it("answers with a validated address whatever host is asked for", () => {
        const callback = vi.fn();
        pinnedLookup(["93.184.216.34"])("evil.example", {}, callback);
        expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    });

    it("hands back every validated address when all are requested", () => {
        const callback = vi.fn();
        pinnedLookup(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])(
            "evil.example",
            { all: true },
            callback,
        );
        expect(callback.mock.calls[0][1]).toEqual([
            { address: "93.184.216.34", family: 4 },
            { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        ]);
    });

    it("refuses to resolve when no address was validated", () => {
        const callback = vi.fn();
        pinnedLookup([])("opencode.ai", {}, callback);
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});
