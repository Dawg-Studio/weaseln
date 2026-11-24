import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const {
    findClientMock,
    findCodeMock,
    updateCodeMock,
    updateManyCodeMock,
    findRefreshMock,
    createRefreshMock,
    updateRefreshMock,
    updateManyRefreshMock,
} = vi.hoisted(() => ({
    findClientMock: vi.fn(),
    findCodeMock: vi.fn(),
    updateCodeMock: vi.fn(),
    updateManyCodeMock: vi.fn(),
    findRefreshMock: vi.fn(),
    createRefreshMock: vi.fn(),
    updateRefreshMock: vi.fn(),
    updateManyRefreshMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        oAuthClient: { findUnique: findClientMock },
        oAuthAuthorizationCode: {
            findUnique: findCodeMock,
            update: updateCodeMock,
            updateMany: updateManyCodeMock,
        },
        oAuthRefreshToken: {
            findUnique: findRefreshMock,
            create: createRefreshMock,
            update: updateRefreshMock,
            updateMany: updateManyRefreshMock,
        },
    },
}));

import { hashSecret } from "@/modules/oauth/clients";
import { s256 } from "@/modules/oauth/pkce";
import { verifyAccessToken } from "@/modules/oauth/tokens";

import { POST } from "./route";

const CLIENT_SECRET = "sk-client-secret";

const client = {
    id: "row-1",
    clientId: "client-1",
    clientSecretHash: hashSecret(CLIENT_SECRET),
    name: "OpenCode",
    redirectUris: ["http://127.0.0.1:19876/callback"],
    scopes: ["posts:read", "posts:write"],
    userId: "alice",
    revokedAt: null,
};

// The expiry is minted per test in beforeEach, so a run stalled past the TTL
// cannot turn the cross-redemption refusals into expiry refusals.
const code = {
    id: "code-row-1",
    codeHash: hashSecret("the-code"),
    clientId: "client-1",
    userId: "alice",
    redirectUri: "http://127.0.0.1:19876/callback",
    codeChallenge: s256("the-verifier"),
    scopes: ["posts:read"],
    usedAt: null,
};

function liveCode() {
    return { ...code, expiresAt: new Date(Date.now() + 60_000) };
}

function tokenRequest(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
        body.append(key, value);
    }
    return new Request("http://localhost/oauth/token", {
        method: "POST",
        body,
    });
}

const exchange = {
    grant_type: "authorization_code",
    client_id: "client-1",
    client_secret: CLIENT_SECRET,
    code: "the-code",
    redirect_uri: "http://127.0.0.1:19876/callback",
    code_verifier: "the-verifier",
};

const METADATA_CLIENT_ID = "https://opencode.ai/oauth/opencode/client.json";

describe("POST /oauth/token", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        vi.stubEnv("AUTH_SECRET", "");
        findClientMock.mockReset();
        findCodeMock.mockReset();
        updateCodeMock.mockReset();
        updateManyCodeMock.mockReset();
        findRefreshMock.mockReset();
        createRefreshMock.mockReset();
        updateRefreshMock.mockReset();
        updateManyRefreshMock.mockReset();
        // The row is answered by the id it asks for, so a URL-shaped id that is
        // not in the registry reads as absent.
        findClientMock.mockImplementation(
            async ({ where }: { where: { clientId: string } }) =>
                where.clientId === client.clientId ? client : null,
        );
        findCodeMock.mockResolvedValue(liveCode());
        updateCodeMock.mockResolvedValue(code);
        updateManyCodeMock.mockResolvedValue({ count: 1 });
        updateManyRefreshMock.mockResolvedValue({ count: 1 });
        createRefreshMock.mockResolvedValue({ id: "refresh-row-2" });
    });

    it("exchanges a code for an access token and a refresh token", async () => {
        const res = await POST(tokenRequest(exchange));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token_type).toBe("Bearer");
        expect(body.expires_in).toBe(3600);
        expect(body.access_token).toBeTruthy();
        expect(body.refresh_token).toBeTruthy();
        expect(body.scope).toBe("posts:read");
        // The code is spent, so it cannot be replayed.
        expect(updateManyCodeMock).toHaveBeenCalledTimes(1);
        expect(createRefreshMock).toHaveBeenCalledTimes(1);
    });

    it("refuses a code another request spent first", async () => {
        // Two concurrent redemptions of one code both read it as unused. The
        // spend has to be the thing that decides, not the read.
        updateManyCodeMock.mockResolvedValue({ count: 0 });

        const res = await POST(tokenRequest(exchange));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
        expect(createRefreshMock).not.toHaveBeenCalled();
    });

    it("answers 401 for a malformed client credential", async () => {
        const res = await POST(
            new Request("http://localhost/oauth/token", {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    // A percent escape that is not a percent escape.
                    authorization: `Basic ${Buffer.from("client%ZZ:secret").toString("base64")}`,
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: "the-code",
                    redirect_uri: "http://127.0.0.1:19876/callback",
                    code_verifier: "the-verifier",
                }).toString(),
            }),
        );

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "invalid_client" });
    });

    it("rejects a replayed code", async () => {
        findCodeMock.mockResolvedValue({ ...liveCode(), usedAt: new Date() });

        const res = await POST(tokenRequest(exchange));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
    });

    it("rejects a code whose verifier does not match", async () => {
        const res = await POST(
            tokenRequest({ ...exchange, code_verifier: "wrong-verifier" }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
    });

    it("rejects a code bound to another client", async () => {
        findCodeMock.mockResolvedValue({
            ...liveCode(),
            clientId: "client-2",
        });

        const res = await POST(tokenRequest(exchange));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
    });

    it("rejects a wrong client secret", async () => {
        const res = await POST(
            tokenRequest({ ...exchange, client_secret: "sk-wrong" }),
        );

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "invalid_client" });
    });

    it("rejects an unknown client", async () => {
        findClientMock.mockResolvedValue(null);

        const res = await POST(tokenRequest(exchange));

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "invalid_client" });
    });

    it("rejects a request for an unsupported grant type", async () => {
        const res = await POST(
            tokenRequest({ ...exchange, grant_type: "password" }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "unsupported_grant_type" });
    });

    it("refuses a refresh token another request spent first", async () => {
        findRefreshMock.mockResolvedValue({
            id: "refresh-row-1",
            tokenHash: hashSecret("the-refresh"),
            clientId: "client-1",
            userId: "alice",
            scopes: ["posts:read"],
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });
        updateManyRefreshMock.mockResolvedValue({ count: 0 });

        const res = await POST(
            tokenRequest({
                grant_type: "refresh_token",
                client_id: "client-1",
                client_secret: CLIENT_SECRET,
                refresh_token: "the-refresh",
            }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
        expect(createRefreshMock).not.toHaveBeenCalled();
    });

    it("rotates the refresh token", async () => {
        findRefreshMock.mockResolvedValue({
            id: "refresh-row-1",
            tokenHash: hashSecret("the-refresh"),
            clientId: "client-1",
            userId: "alice",
            scopes: ["posts:read"],
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        const res = await POST(
            tokenRequest({
                grant_type: "refresh_token",
                client_id: "client-1",
                client_secret: CLIENT_SECRET,
                refresh_token: "the-refresh",
            }),
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.access_token).toBeTruthy();
        expect(body.refresh_token).toBeTruthy();
        // The old refresh token is spent and a new one is minted.
        expect(updateManyRefreshMock).toHaveBeenCalledTimes(1);
        expect(createRefreshMock).toHaveBeenCalledTimes(1);
    });

    it("redeems a code for a public metadata client without a secret", async () => {
        findCodeMock.mockResolvedValue({
            ...liveCode(),
            clientId: METADATA_CLIENT_ID,
            codeChallenge: s256("verifier"),
        });

        const res = await POST(
            tokenRequest({
                grant_type: "authorization_code",
                client_id: METADATA_CLIENT_ID,
                code: "the-code",
                redirect_uri: "http://127.0.0.1:19876/callback",
                code_verifier: "verifier",
            }),
        );

        expect(res.status).toBe(200);
        // A URL-shaped id that is not in the registry is a public client.
        expect(findClientMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { clientId: METADATA_CLIENT_ID } }),
        );
        const body = await res.json();
        expect(verifyAccessToken(body.access_token)?.userId).toBe(code.userId);
    });

    it("refuses a secretless metadata URL that the registry also carries", async () => {
        // A registered client is confidential. If the id also names a row, the
        // secretless spelling must not be accepted for it.
        findClientMock.mockResolvedValue({
            ...client,
            clientId: METADATA_CLIENT_ID,
        });

        const res = await POST(
            tokenRequest({
                grant_type: "authorization_code",
                client_id: METADATA_CLIENT_ID,
                code: "the-code",
                redirect_uri: "http://127.0.0.1:19876/callback",
                code_verifier: "the-verifier",
            }),
        );

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "invalid_client" });
        expect(updateManyCodeMock).not.toHaveBeenCalled();
    });

    it("refuses a secretless request whose client_id is not a metadata URL", async () => {
        const res = await POST(
            tokenRequest({
                grant_type: "authorization_code",
                client_id: "client-1",
                code: "the-code",
                redirect_uri: "http://127.0.0.1:19876/callback",
                code_verifier: "verifier",
            }),
        );

        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ error: "invalid_client" });
    });

    it("refuses a metadata URL redeeming a code issued to a registered client", async () => {
        // The stored row (the fixture) belongs to "client-1"; the presented id
        // is the URL. The comparison on the stored row is the only refusal.
        const res = await POST(
            tokenRequest({
                grant_type: "authorization_code",
                client_id: METADATA_CLIENT_ID,
                code: "the-code",
                redirect_uri: "http://127.0.0.1:19876/callback",
                code_verifier: "the-verifier",
            }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
        expect(updateManyCodeMock).not.toHaveBeenCalled();
    });

    it("rotates a public client's refresh token without a secret", async () => {
        findRefreshMock.mockResolvedValue({
            id: "refresh-row-1",
            tokenHash: hashSecret("the-refresh"),
            clientId: METADATA_CLIENT_ID,
            userId: "alice",
            scopes: ["posts:read"],
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        const res = await POST(
            tokenRequest({
                grant_type: "refresh_token",
                client_id: METADATA_CLIENT_ID,
                refresh_token: "the-refresh",
            }),
        );

        expect(res.status).toBe(200);
        expect(findClientMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { clientId: METADATA_CLIENT_ID } }),
        );
        expect(updateManyRefreshMock).toHaveBeenCalledWith({
            where: { id: "refresh-row-1", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        expect(createRefreshMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    clientId: METADATA_CLIENT_ID,
                    userId: "alice",
                }),
            }),
        );
    });

    it("refuses a metadata URL rotating a refresh token of a registered client", async () => {
        findRefreshMock.mockResolvedValue({
            id: "refresh-row-1",
            tokenHash: hashSecret("the-refresh"),
            clientId: "client-1",
            userId: "alice",
            scopes: ["posts:read"],
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        const res = await POST(
            tokenRequest({
                grant_type: "refresh_token",
                client_id: METADATA_CLIENT_ID,
                refresh_token: "the-refresh",
            }),
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant" });
        expect(updateManyRefreshMock).not.toHaveBeenCalled();
        expect(createRefreshMock).not.toHaveBeenCalled();
    });
});
