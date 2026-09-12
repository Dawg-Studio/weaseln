import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it (same pattern as
// organization.test.ts, post.test.ts — established repo convention).
const { executeRawMock, queryRawMock, userCountMock } = vi.hoisted(() => ({
    executeRawMock: vi.fn(),
    queryRawMock: vi.fn(),
    userCountMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        $executeRaw: executeRawMock,
        $queryRaw: queryRawMock,
        user: { count: userCountMock },
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));
vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

import { updateInterest, getTagRankings } from "@/utils/actions/tag";

beforeEach(() => {
    executeRawMock.mockReset();
    queryRawMock.mockReset();
    userCountMock.mockReset();
});

describe("updateInterest", () => {
    it("calls array_append then array_remove via $executeRaw when append finds nothing to add (2 calls total)", async () => {
        // ponytail: append returns 0 when the NOT(ANY) WHERE excluded every row
        // (the user already has the tag) — that is the unfollow branch.
        executeRawMock.mockResolvedValueOnce(0);
        executeRawMock.mockResolvedValueOnce(1);
        await updateInterest("ai");
        expect(executeRawMock).toHaveBeenCalledTimes(2);
    });

    it("skips the remove branch when append succeeded (returns 1)", async () => {
        executeRawMock.mockResolvedValueOnce(1); // appended
        await updateInterest("ai");
        expect(executeRawMock).toHaveBeenCalledTimes(1);
    });
});

describe("getTagRankings", () => {
    it("issues 2 $queryRaw calls and 0 user.count calls (delegates to helper)", async () => {
        queryRawMock
            .mockResolvedValueOnce([{ tag: "ai", usage: 5n }])
            .mockResolvedValueOnce([{ tag: "ai", followers: 1n }]);
        const out = await getTagRankings();
        expect(queryRawMock).toHaveBeenCalledTimes(2);
        expect(userCountMock).not.toHaveBeenCalled();
        expect(Array.isArray(out)).toBe(true);
    });
});
