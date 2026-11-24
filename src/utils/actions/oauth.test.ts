import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const {
    authMock,
    resolveClientMock,
    findClientMock,
    createMock,
    redirectMock,
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    resolveClientMock: vi.fn(),
    findClientMock: vi.fn(),
    createMock: vi.fn(),
    redirectMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        oAuthAuthorizationCode: { create: createMock },
    },
}));
// Partial mock: the two lookups are the seam, hashSecret stays real.
vi.mock("@/modules/oauth/clients", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/modules/oauth/clients")>();
    return {
        ...actual,
        resolveClient: resolveClientMock,
        findOAuthClient: findClientMock,
    };
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { OAUTH_SCOPES } from "@/modules/oauth/scopes";
import { approveAuthorization, denyAuthorization } from "@/utils/actions/oauth";

const registeredRow = {
    id: "row-1",
    clientId: "client-1",
    clientSecretHash: "hash",
    redirectUris: ["http://127.0.0.1:19876/callback"],
    scopes: ["posts:read", "posts:write"],
    userId: "alice",
    revokedAt: null,
};

const client = {
    clientId: "client-1",
    name: "Registered client",
    redirectUris: ["http://127.0.0.1:19876/callback"],
    allowedScopes: ["posts:read", "posts:write"],
    origin: null,
    public: false,
};

const publicClient = {
    clientId: "https://opencode.ai/oauth/opencode/client.json",
    name: "opencode",
    redirectUris: ["http://127.0.0.1/callback"],
    allowedScopes: null,
    origin: "opencode.ai",
    public: true,
};

const request = {
    clientId: "client-1",
    redirectUri: "http://127.0.0.1:19876/callback",
    codeChallenge: "challenge-1",
    codeChallengeMethod: "S256",
    scope: "posts:read",
    state: "xyz",
};

describe("oauth consent actions", () => {
    beforeEach(() => {
        authMock.mockReset();
        resolveClientMock.mockReset();
        findClientMock.mockReset();
        createMock.mockReset();
        redirectMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "alice" } });
        resolveClientMock.mockResolvedValue(client);
        findClientMock.mockResolvedValue(registeredRow);
        redirectMock.mockImplementation((url: string) => {
            throw new Error(`REDIRECT ${url}`);
        });
    });

    it("refuses to authorize a client owned by another user", async () => {
        findClientMock.mockResolvedValue({ ...registeredRow, userId: "bob" });

        await expect(approveAuthorization(request)).rejects.toThrow(
            "Not authorized",
        );
        expect(createMock).not.toHaveBeenCalled();
    });

    it("refuses a redirect URI that is not registered", async () => {
        await expect(
            approveAuthorization({
                ...request,
                redirectUri: "http://evil.example.com/callback",
            }),
        ).rejects.toThrow("Invalid redirect URI");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("refuses the plain PKCE method", async () => {
        await expect(
            approveAuthorization({
                ...request,
                codeChallengeMethod: "plain",
            }),
        ).rejects.toThrow("Invalid code challenge");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("refuses a scope outside the client's registered scopes", async () => {
        await expect(
            approveAuthorization({ ...request, scope: "org:write" }),
        ).rejects.toThrow("Invalid scope");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a single-use code bound to the client, user and redirect URI", async () => {
        await expect(approveAuthorization(request)).rejects.toThrow(/REDIRECT/);

        expect(createMock).toHaveBeenCalledTimes(1);
        const data = createMock.mock.calls[0][0].data;
        expect(data.clientId).toBe("client-1");
        expect(data.userId).toBe("alice");
        expect(data.redirectUri).toBe("http://127.0.0.1:19876/callback");
        expect(data.codeChallenge).toBe("challenge-1");
        expect(data.scopes).toEqual(["posts:read"]);
        // The code itself is never stored.
        expect(data.codeHash).not.toBeUndefined();
        const ttl = data.expiresAt.getTime() - Date.now();
        expect(ttl).toBeGreaterThan(50_000);
        expect(ttl).toBeLessThanOrEqual(60_000);
    });

    it("redirects to the client with the code and the state", async () => {
        await expect(approveAuthorization(request)).rejects.toThrow(
            /code=.*state=xyz/,
        );
    });

    it("redirects to the client with access_denied on refusal", async () => {
        await expect(
            denyAuthorization({
                clientId: "client-1",
                redirectUri: "http://127.0.0.1:19876/callback",
                state: "xyz",
            }),
        ).rejects.toThrow(/error=access_denied.*state=xyz/);
    });

    it("authorizes a public metadata client and binds the code to the consenter", async () => {
        resolveClientMock.mockResolvedValueOnce(publicClient);
        await expect(
            approveAuthorization({
                ...request,
                clientId: "https://opencode.ai/oauth/opencode/client.json",
                redirectUri: "http://127.0.0.1:19876/callback",
                scope: "posts:read posts:write",
            }),
        ).rejects.toThrow(/REDIRECT/);
        const data = createMock.mock.calls[0][0].data;
        expect(data.clientId).toBe(
            "https://opencode.ai/oauth/opencode/client.json",
        );
        expect(data.userId).toBe("alice");
        expect(data.scopes).toEqual(["posts:read", "posts:write"]);
    });

    it("refuses a scope weaseln does not know for a public client", async () => {
        resolveClientMock.mockResolvedValueOnce(publicClient);
        await expect(
            approveAuthorization({
                ...request,
                clientId: "https://opencode.ai/oauth/opencode/client.json",
                scope: "posts:read admin:everything",
            }),
        ).rejects.toThrow("Invalid scope");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("grants the full known set when a public client asks for no scope", async () => {
        // OpenCode's scope default comes from the WWW-Authenticate challenge, which
        // weaseln does not populate, so an empty request is the expected case.
        resolveClientMock.mockResolvedValueOnce(publicClient);
        await expect(
            approveAuthorization({
                ...request,
                clientId: "https://opencode.ai/oauth/opencode/client.json",
                scope: "",
            }),
        ).rejects.toThrow(/REDIRECT/);
        expect(createMock.mock.calls[0][0].data.scopes).toEqual([
            ...OAUTH_SCOPES,
        ]);
    });

    it("grants nothing when a registered client asks for no scope", async () => {
        await expect(
            approveAuthorization({ ...request, scope: "" }),
        ).rejects.toThrow(/REDIRECT/);
        expect(createMock.mock.calls[0][0].data.scopes).toEqual([]);
    });
});
