import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const { authMock, findUniqueMock, createMock, redirectMock } = vi.hoisted(
    () => ({
        authMock: vi.fn(),
        findUniqueMock: vi.fn(),
        createMock: vi.fn(),
        redirectMock: vi.fn(),
    }),
);

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        oAuthClient: { findUnique: findUniqueMock },
        oAuthAuthorizationCode: { create: createMock },
    },
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { approveAuthorization, denyAuthorization } from "@/utils/actions/oauth";

const client = {
    id: "row-1",
    clientId: "client-1",
    clientSecretHash: "hash",
    redirectUris: ["http://127.0.0.1:19876/callback"],
    scopes: ["posts:read", "posts:write"],
    userId: "alice",
    revokedAt: null,
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
        findUniqueMock.mockReset();
        createMock.mockReset();
        redirectMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "alice" } });
        findUniqueMock.mockResolvedValue(client);
        redirectMock.mockImplementation((url: string) => {
            throw new Error(`REDIRECT ${url}`);
        });
    });

    it("refuses to authorize a client owned by another user", async () => {
        findUniqueMock.mockResolvedValue({ ...client, userId: "bob" });

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
});
