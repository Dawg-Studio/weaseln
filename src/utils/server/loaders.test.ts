import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it (PD3).
const {
    userFindFirstMock,
    userFindUniqueMock,
    postFindUniqueMock,
    seriesFindFirstMock,
    queryRawMock,
    authMock,
} = vi.hoisted(() => ({
    userFindFirstMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    postFindUniqueMock: vi.fn(),
    seriesFindFirstMock: vi.fn(),
    queryRawMock: vi.fn(),
    authMock: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        user: { findFirst: userFindFirstMock, findUnique: userFindUniqueMock },
        post: { findUnique: postFindUniqueMock },
        postSeries: { findFirst: seriesFindFirstMock },
        $queryRaw: queryRawMock,
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { getProfile, getSessionUser, getPost, getSeries, getAllTags } from "@/utils/server/loaders";

beforeEach(() => {
    userFindFirstMock.mockReset();
    userFindUniqueMock.mockReset();
    postFindUniqueMock.mockReset();
    seriesFindFirstMock.mockReset();
    queryRawMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
});

describe("getProfile", () => {
    // ponytail: React.cache dedupes via AsyncLocalStorage seeded by React's
    // render context. Neither vitest's jsdom nor node env seeds that context
    // for unit tests, so the "two calls → one DB hit" assertion fails in both
    // (verified on node env: 2 calls hit Prisma both times). Skipping per
    // brief; rely on the smoke test (Step 4 of T15) for the dedup guarantee,
    // which needs a real React render to wire up AsyncLocalStorage.
    it.skip("caches: two calls → one DB hit", async () => {
        userFindFirstMock.mockResolvedValue({ id: "u1" });
        await getProfile("u1");
        await getProfile("u1");
        expect(userFindFirstMock).toHaveBeenCalledTimes(1);
    });

    it("looks up by id OR username", async () => {
        userFindFirstMock.mockResolvedValue({ id: "u1" });
        await getProfile("alice");
        expect(userFindFirstMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { OR: [{ id: "alice" }, { username: "alice" }] } }),
        );
    });
});

describe("getSessionUser", () => {
    it("returns null when no session", async () => {
        authMock.mockResolvedValueOnce(null);
        const u = await getSessionUser();
        expect(u).toBeNull();
    });

    it("returns the user when session is set", async () => {
        userFindUniqueMock.mockResolvedValueOnce({ id: "u1", name: "Alice" });
        const u = await getSessionUser();
        expect(u).toEqual({ id: "u1", name: "Alice" });
    });
});

describe("getAllTags", () => {
    // ponytail: brief's `expect(out).toEqual(["ai", "rust"])` contradicts the
    // brief's own description ("the shared $queryRaw distinct tags used by
    // /new and /edit" — which is `src/app/api/tag/route.ts`'s distinct +
    // default_tags union, deduped and sorted). Asserting the contract the
    // brief's prose specifies: one $queryRaw, result contains both queryRaw
    // rows and is sorted.
    it("issues one $queryRaw for distinct tags", async () => {
        queryRawMock.mockResolvedValueOnce([{ tag: "ai" }, { tag: "rust" }]);
        const out = await getAllTags();
        expect(queryRawMock).toHaveBeenCalledTimes(1);
        expect(out).toContain("ai");
        expect(out).toContain("rust");
        expect([...out].sort()).toEqual(out);
    });
});

describe("getPost / getSeries", () => {
    // ponytail: same React.cache / AsyncLocalStorage caveat as the getProfile
    // cache test — verified to fail on both jsdom and node envs. Skipped; the
    // smoke test (Step 4 of T15) verifies the dedup at render time.
    it.skip("getPost caches", async () => {
        postFindUniqueMock.mockResolvedValue({ id: "p1" });
        await getPost("slug");
        await getPost("slug");
        expect(postFindUniqueMock).toHaveBeenCalledTimes(1);
    });

    it.skip("getSeries caches", async () => {
        seriesFindFirstMock.mockResolvedValue({ id: "s1" });
        await getSeries("u1", "s1");
        await getSeries("u1", "s1");
        expect(seriesFindFirstMock).toHaveBeenCalledTimes(1);
    });
});
