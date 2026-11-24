import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: the reader resolves the hostname before fetching, so the resolver
// is mocked too. Otherwise every case would do real DNS.
const { lookupMock } = vi.hoisted(() => ({
    lookupMock: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("node:dns/promises", () => ({
    lookup: lookupMock,
    default: { lookup: lookupMock },
}));

import {
    fetchClientMetadata,
    isClientMetadataUrl,
    isPublicAddress,
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn(
        async () =>
            new Response(JSON.stringify(DOC), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
    );
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

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
            "::ffff:127.0.0.1",
            "::ffff:7f00:1",
        ]) {
            expect(isPublicAddress(ip), ip).toBe(false);
        }
    });
    it("accepts a public address", () => {
        expect(isPublicAddress("93.184.216.34")).toBe(true);
    });
});

describe("fetchClientMetadata", () => {
    it("returns the name and redirect uris", async () => {
        const metadata = await fetchClientMetadata(DOC.client_id);
        expect(metadata.clientName).toBe("opencode");
        expect(metadata.redirectUris).toEqual(DOC.redirect_uris);
    });

    it("refuses a document whose client_id does not match the url", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...DOC, client_id: "https://evil.example/client.json" })));
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow(/client_id/);
    });

    it("refuses a document that wants a client secret", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...DOC, token_endpoint_auth_method: "client_secret_post" })));
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow(/none/);
    });

    it("refuses a document with no usable redirect uri", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...DOC, redirect_uris: ["ftp://x/y"] })));
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow(/redirect/i);
    });

    it("refuses a document that is not json", async () => {
        fetchMock.mockResolvedValueOnce(new Response("<html>nope</html>"));
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow();
    });

    it("reports a failed fetch instead of throwing a raw network error", async () => {
        fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow(/could not be read/i);
    });

    it("refuses to fetch when the host resolves to a private address", async () => {
        lookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
        await expect(fetchClientMetadata(DOC.client_id)).rejects.toThrow(/not a public/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
