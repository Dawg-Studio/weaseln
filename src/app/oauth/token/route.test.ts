import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const {
    findClientMock,
    findCodeMock,
    updateCodeMock,
    findRefreshMock,
    createRefreshMock,
    updateRefreshMock,
} = vi.hoisted(() => ({
    findClientMock: vi.fn(),
    findCodeMock: vi.fn(),
    updateCodeMock: vi.fn(),
    findRefreshMock: vi.fn(),
    createRefreshMock: vi.fn(),
    updateRefreshMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        oAuthClient: { findUnique: findClientMock },
        oAuthAuthorizationCode: {
            findUnique: findCodeMock,
            update: updateCodeMock,
        },
        oAuthRefreshToken: {
            findUnique: findRefreshMock,
            create: createRefreshMock,
            update: updateRefreshMock,
        },
    },
}));

import { hashSecret } from "@/modules/oauth/clients";
import { s256 } from "@/modules/oauth/pkce";

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

const code = {
    id: "code-row-1",
    codeHash: hashSecret("the-code"),
    clientId: "client-1",
    userId: "alice",
    redirectUri: "http://127.0.0.1:19876/callback",
    codeChallenge: s256("the-verifier"),
    scopes: ["posts:read"],
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
};

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

describe("POST /oauth/token", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        vi.stubEnv("AUTH_SECRET", "");
        findClientMock.mockReset();
        findCodeMock.mockReset();
        updateCodeMock.mockReset();
        findRefreshMock.mockReset();
        createRefreshMock.mockReset();
        updateRefreshMock.mockReset();
        findClientMock.mockResolvedValue(client);
        findCodeMock.mockResolvedValue(code);
        updateCodeMock.mockResolvedValue(code);
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
        expect(updateCodeMock).toHaveBeenCalledTimes(1);
        expect(createRefreshMock).toHaveBeenCalledTimes(1);
    });

    it("rejects a replayed code", async () => {
        findCodeMock.mockResolvedValue({ ...code, usedAt: new Date() });

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
        findCodeMock.mockResolvedValue({ ...code, clientId: "client-2" });

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
        expect(updateRefreshMock).toHaveBeenCalledTimes(1);
        expect(createRefreshMock).toHaveBeenCalledTimes(1);
    });
});
