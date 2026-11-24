import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const {
    createMock,
    fetchMetadataMock,
    findManyMock,
    findUniqueMock,
    updateMock,
    updateManyMock,
} = vi.hoisted(() => ({
    createMock: vi.fn(),
    fetchMetadataMock: vi.fn(),
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    updateManyMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        oAuthClient: {
            create: createMock,
            findMany: findManyMock,
            findUnique: findUniqueMock,
            update: updateMock,
        },
        oAuthRefreshToken: {
            updateMany: updateManyMock,
        },
    },
}));

vi.mock("@/modules/oauth/client-metadata", async () => {
    const actual = await vi.importActual<typeof import("@/modules/oauth/client-metadata")>("@/modules/oauth/client-metadata");
    return { ...actual, fetchClientMetadata: fetchMetadataMock };
});

import {
    findOAuthClient,
    hashSecret,
    listOAuthClients,
    registerOAuthClient,
    resolveClient,
    revokeOAuthClient,
    verifyClientSecret,
} from "./clients";

const actor = { userId: "alice" };

describe("oauth client registry", () => {
    beforeEach(() => {
        createMock.mockReset();
        findManyMock.mockReset();
        findUniqueMock.mockReset();
        updateMock.mockReset();
        updateManyMock.mockReset();
        createMock.mockResolvedValue({
            id: "client-row-1",
            clientId: "client-1",
            clientSecretHash: "hash",
        });
        findUniqueMock.mockResolvedValue({
            id: "client-row-1",
            clientId: "client-1",
            clientSecretHash: "hash",
            redirectUris: ["http://127.0.0.1:19876/callback"],
            scopes: ["posts:read"],
            userId: "alice",
            revokedAt: null,
        });
    });

    it("returns the client secret only at creation", async () => {
        const created = await registerOAuthClient(actor, {
            name: "OpenCode",
            redirectUris: ["http://127.0.0.1:19876/callback"],
            scopes: ["posts:read"],
        });

        expect(created.clientSecret).toMatch(/^sk-/);
        // The row holds the hash, never the secret itself.
        const data = createMock.mock.calls[0][0].data;
        expect(data.clientSecretHash).toBe(hashSecret(created.clientSecret));
        expect(data.clientSecretHash).not.toBe(created.clientSecret);
    });

    it("refuses to register for another user", async () => {
        await registerOAuthClient(actor, {
            name: "OpenCode",
            redirectUris: ["http://127.0.0.1:19876/callback"],
            scopes: ["posts:read"],
        });

        expect(createMock.mock.calls[0][0].data.userId).toBe("alice");
    });

    it("revokes the client and its refresh tokens", async () => {
        await revokeOAuthClient(actor, { clientId: "client-1" });

        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateMock.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
        expect(updateManyMock).toHaveBeenCalledTimes(1);
        expect(
            updateManyMock.mock.calls[0][0].where.clientId,
        ).toBe("client-1");
    });

    it("verifies a client secret by hash", () => {
        expect(verifyClientSecret(hashSecret("sk-abc"), "sk-abc")).toBe(true);
        expect(verifyClientSecret(hashSecret("sk-abc"), "sk-wrong")).toBe(
            false,
        );
    });

    it("refuses a revoked client", async () => {
        findUniqueMock.mockResolvedValue({
            id: "client-row-1",
            clientId: "client-1",
            clientSecretHash: "hash",
            redirectUris: [],
            scopes: [],
            userId: "alice",
            revokedAt: new Date(),
        });

        const client = await findOAuthClient("client-1");

        expect(client?.revokedAt).not.toBeNull();
    });

    it("lists only the caller's clients", async () => {
        findManyMock.mockResolvedValue([]);

        await listOAuthClients(actor);

        expect(findManyMock.mock.calls[0][0].where).toEqual({ userId: "alice" });
    });
});

describe("resolveClient", () => {
    beforeEach(() => {
        findUniqueMock.mockReset().mockResolvedValue(null);
        fetchMetadataMock.mockReset();
    });

    it("returns a registered client, not public, with its registered scopes", async () => {
        findUniqueMock.mockResolvedValueOnce({
            id: "row-1", clientId: "client-1", clientSecretHash: "h", name: "OpenCode",
            redirectUris: ["http://127.0.0.1:19876/callback"], scopes: ["posts:read"],
            userId: "alice", revokedAt: null,
        });
        const client = await resolveClient("client-1");
        expect(client).toMatchObject({ name: "OpenCode", public: false, origin: null, allowedScopes: ["posts:read"] });
        expect(client?.userId).toBe("alice");
    });

    it("returns a metadata client, public, with no scope ceiling and its origin", async () => {
        fetchMetadataMock.mockResolvedValueOnce({
            clientId: "https://opencode.ai/oauth/opencode/client.json",
            clientName: "opencode",
            redirectUris: ["http://127.0.0.1/callback"],
        });
        const client = await resolveClient("https://opencode.ai/oauth/opencode/client.json");
        expect(client).toMatchObject({ name: "opencode", public: true, origin: "opencode.ai", allowedScopes: null });
        expect(client?.userId).toBeNull();
    });

    it("returns null for an unknown opaque client id", async () => {
        expect(await resolveClient("nobody")).toBeNull();
        expect(fetchMetadataMock).not.toHaveBeenCalled();
    });

    it("refuses a revoked registered client", async () => {
        findUniqueMock.mockResolvedValueOnce({
            id: "row-1", clientId: "client-1", clientSecretHash: "h", name: "x",
            redirectUris: [], scopes: [], userId: "alice", revokedAt: new Date(),
        });
        expect(await resolveClient("client-1")).toBeNull();
    });
});
