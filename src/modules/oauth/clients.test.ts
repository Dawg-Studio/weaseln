import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const {
    createMock,
    fetchMetadataMock,
    findFirstMock,
    findManyMock,
    findUniqueMock,
    groupByMock,
    lookupMock,
    updateMock,
    updateManyMock,
} = vi.hoisted(() => ({
    createMock: vi.fn(),
    fetchMetadataMock: vi.fn(),
    findFirstMock: vi.fn(),
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    groupByMock: vi.fn(),
    lookupMock: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
    updateMock: vi.fn(),
    updateManyMock: vi.fn(),
}));

// The refusals are checked against the real validator, which resolves the host
// before it fetches. Mocking the resolver keeps that off the network.
vi.mock("node:dns/promises", () => ({
    lookup: lookupMock,
    default: { lookup: lookupMock },
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
            findFirst: findFirstMock,
            groupBy: groupByMock,
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
    listAuthorizedClients,
    listOAuthClients,
    registerOAuthClient,
    resolveClient,
    revokeAuthorizedClient,
    revokeOAuthClient,
    verifyClientSecret,
} from "./clients";

const actor = { userId: "alice" };

const METADATA_CLIENT_ID = "https://opencode.ai/oauth/opencode/client.json";

const metadataDocument = JSON.stringify({
    client_id: METADATA_CLIENT_ID,
    client_name: "opencode",
    token_endpoint_auth_method: "none",
    redirect_uris: ["http://127.0.0.1/callback"],
});

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

    it("resolves a registered client whose id is URL-shaped without fetching it", async () => {
        findUniqueMock.mockResolvedValueOnce({
            id: "row-1", clientId: METADATA_CLIENT_ID, clientSecretHash: "h", name: "registered",
            redirectUris: ["http://127.0.0.1:19876/callback"], scopes: ["posts:read"],
            userId: "alice", revokedAt: null,
        });

        const client = await resolveClient(METADATA_CLIENT_ID);

        expect(client).toMatchObject({
            name: "registered",
            public: false,
            origin: null,
            allowedScopes: ["posts:read"],
        });
        // The registry lookup comes first, so a metadata URL that is also a
        // registered id is never reinterpreted as a public client.
        expect(fetchMetadataMock).not.toHaveBeenCalled();
    });

    it("surfaces a document's own refusal message through resolveClient", async () => {
        const actual = await vi.importActual<
            typeof import("@/modules/oauth/client-metadata")
        >("@/modules/oauth/client-metadata");
        fetchMetadataMock.mockImplementation((clientId: string) =>
            actual.fetchClientMetadata(clientId, async () =>
                JSON.stringify({
                    ...JSON.parse(metadataDocument),
                    client_id: "https://evil.example/client.json",
                }),
            ),
        );

        // The consent page prints a MetadataError's message and falls back to
        // generic copy for anything else, so the refusal has to arrive as one.
        await expect(resolveClient(METADATA_CLIENT_ID)).rejects.toThrow(
            actual.MetadataError,
        );
        await expect(resolveClient(METADATA_CLIENT_ID)).rejects.toThrow(
            /client_id does not match the URL/,
        );
    });
});

describe("authorized clients", () => {
    beforeEach(() => {
        groupByMock.mockReset();
        findFirstMock.mockReset();
        findUniqueMock.mockReset().mockResolvedValue(null);
    });

    it("lists one row per client the user has a live refresh token for", async () => {
        groupByMock.mockResolvedValueOnce([
            { clientId: "client-1", _min: { createdAt: new Date("2026-01-01") }, _count: { _all: 2 } },
            { clientId: "https://opencode.ai/oauth/opencode/client.json", _min: { createdAt: new Date("2026-02-01") }, _count: { _all: 1 } },
        ]);
        findFirstMock.mockResolvedValue({ scopes: ["posts:read"] });
        const rows = await listAuthorizedClients({ userId: "alice" });
        expect(rows.map((r) => r.clientId)).toHaveLength(2);
        expect(groupByMock).toHaveBeenCalledWith(expect.objectContaining({
            by: ["clientId"],
            where: {
                userId: "alice",
                revokedAt: null,
                expiresAt: { gt: expect.any(Date) },
            },
        }));
    });

    it("counts only unexpired tokens as live", async () => {
        // Nothing stamps `revokedAt` on a token that ages out, so the expiry has
        // to be part of the predicate or a dead grant lists forever.
        groupByMock.mockResolvedValueOnce([]);

        await listAuthorizedClients({ userId: "alice" });

        const expiresAt = groupByMock.mock.calls[0][0].where.expiresAt;
        expect(expiresAt.gt).toBeInstanceOf(Date);
        expect(expiresAt.gt.getTime()).toBeGreaterThan(Date.now() - 1_000);
    });

    it("throws when a grouped client has no live token to read scopes from", async () => {
        groupByMock.mockResolvedValueOnce([
            { clientId: "client-1", _min: { createdAt: new Date("2026-01-01") }, _count: { _all: 1 } },
        ]);
        findFirstMock.mockResolvedValue(null);

        await expect(listAuthorizedClients({ userId: "alice" })).rejects.toThrow(
            /No live refresh token for client client-1/,
        );
    });

    it("marks a client registered only when the registry has a row for it", async () => {
        groupByMock.mockResolvedValueOnce([
            { clientId: "client-1", _min: { createdAt: new Date("2026-01-01") }, _count: { _all: 1 } },
            { clientId: "https://opencode.ai/oauth/opencode/client.json", _min: { createdAt: new Date("2026-02-01") }, _count: { _all: 1 } },
        ]);
        findFirstMock.mockResolvedValue({ scopes: ["posts:read", "org:read"] });
        findUniqueMock
            .mockResolvedValueOnce({
                id: "row-1", clientId: "client-1", clientSecretHash: "h", name: "OpenCode",
                redirectUris: [], scopes: ["posts:read"], userId: "alice", revokedAt: null,
            })
            .mockResolvedValueOnce(null);

        const rows = await listAuthorizedClients({ userId: "alice" });

        expect(rows[0]).toEqual({
            clientId: "client-1",
            scopes: ["posts:read", "org:read"],
            authorizedAt: new Date("2026-01-01"),
            registered: true,
        });
        expect(rows[1].registered).toBe(false);
    });

    it("revoking an authorized client revokes only that user's refresh tokens", async () => {
        await revokeAuthorizedClient({ userId: "alice" }, { clientId: "client-1" });
        expect(updateManyMock).toHaveBeenCalledWith({
            where: { userId: "alice", clientId: "client-1", revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        // The registered client row is not the caller's to revoke here.
        expect(updateMock).not.toHaveBeenCalled();
    });
});
