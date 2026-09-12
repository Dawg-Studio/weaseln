import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it (plan defect PD3).
const {
    queryRawMock,
    postFindManyMock,
    userCountMock,
    tagsRankingFindFirstMock,
} = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    postFindManyMock: vi.fn(),
    userCountMock: vi.fn(),
    tagsRankingFindFirstMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        $queryRaw: queryRawMock,
        post: { findMany: postFindManyMock },
        user: { count: userCountMock },
        tagsRanking: { findFirst: tagsRankingFindFirstMock },
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { computeTagRankings, readTagsRanking, __resetTagsRankingCacheForTest } from "@/utils/services/ranking";

beforeEach(() => {
    queryRawMock.mockReset();
    postFindManyMock.mockReset();
    userCountMock.mockReset();
    tagsRankingFindFirstMock.mockReset();
    __resetTagsRankingCacheForTest();
});

describe("computeTagRankings", () => {
    it("issues exactly 2 $queryRaw calls and zero per-tag user.count calls", async () => {
        queryRawMock
            .mockResolvedValueOnce([{ tag: "ai", usage: 5n }, { tag: "rust", usage: 3n }])
            .mockResolvedValueOnce([{ tag: "ai", followers: 2n }, { tag: "rust", followers: 1n }]);

        const out = await computeTagRankings();

        expect(queryRawMock).toHaveBeenCalledTimes(2);
        expect(userCountMock).not.toHaveBeenCalled();
        expect(postFindManyMock).not.toHaveBeenCalled();
        expect(out).toEqual([
            { tag: "ai", usage: 5, followers: 2 },
            { tag: "rust", usage: 3, followers: 1 },
        ]);
    });

    it("joins usage and followers by tag even when one side is missing a tag", async () => {
        queryRawMock
            .mockResolvedValueOnce([{ tag: "ai", usage: 5n }])
            .mockResolvedValueOnce([{ tag: "ai", followers: 2n }, { tag: "rust", followers: 1n }]);

        const out = await computeTagRankings();
        expect(out).toEqual([{ tag: "ai", usage: 5, followers: 2 }]);
    });
});

describe("readTagsRanking", () => {
    it("returns cached data within TTL", async () => {
        tagsRankingFindFirstMock.mockResolvedValueOnce({ data: [{ tag: "ai", usage: 5, followers: 2 }] });
        const first = await readTagsRanking();
        const second = await readTagsRanking();
        expect(second).toBe(first); // same reference (cached)
        expect(tagsRankingFindFirstMock).toHaveBeenCalledTimes(1);
    });

    it("re-queries after TTL expires", async () => {
        tagsRankingFindFirstMock.mockResolvedValue({ data: [{ tag: "ai", usage: 5, followers: 2 }] });
        await readTagsRanking();
        // ponytail: 60s TTL — advance fake Date.now() past expiresAt, then
        // re-query while fake timers are still active so the cache check sees
        // the advanced time. Restore real timers after the second read.
        vi.useFakeTimers();
        vi.advanceTimersByTime(61_000);
        await readTagsRanking();
        vi.useRealTimers();
        expect(tagsRankingFindFirstMock).toHaveBeenCalledTimes(2);
    });

    it("returns [] when the TagsRanking table is empty", async () => {
        tagsRankingFindFirstMock.mockResolvedValueOnce(null);
        const out = await readTagsRanking();
        expect(out).toEqual([]);
    });
});
