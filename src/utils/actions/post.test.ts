import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it (plan defect PD3).
const {
    transactionMock,
    findUniqueMock,
    updateMock,
    upsertMock,
    authMock,
} = vi.hoisted(() => ({
    transactionMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    upsertMock: vi.fn(),
    authMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        $transaction: transactionMock,
        user: { findUnique: findUniqueMock, update: updateMock },
        postReadingHistory: { upsert: upsertMock },
    },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import {
    addOrUpdateUserPostReadingHistory,
    setBookmarkPost,
} from "@/utils/actions/post";

beforeEach(() => {
    transactionMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    upsertMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user1" } });
});

describe("setBookmarkPost", () => {
    it("runs read + write inside one $transaction", async () => {
        findUniqueMock.mockResolvedValueOnce({ id: "user1" });
        updateMock.mockResolvedValueOnce({});
        transactionMock.mockImplementationOnce(async (cb) =>
            cb({ user: { findUnique: findUniqueMock, update: updateMock } }),
        );

        await setBookmarkPost("title1");

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(findUniqueMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user1", bookMarks: { some: { titleId: "title1" } } },
                select: { id: true },
            }),
        );
    });

    it("returns 'bookmarked' when adding a new bookmark", async () => {
        findUniqueMock.mockResolvedValueOnce(null);
        transactionMock.mockImplementationOnce(async (cb) =>
            cb({ user: { findUnique: findUniqueMock, update: updateMock } }),
        );

        const out = await setBookmarkPost("title1");
        expect(out).toBe("bookmarked");
    });
});

describe("addOrUpdateUserPostReadingHistory", () => {
    it("issues exactly one upsert against prisma.postReadingHistory", async () => {
        upsertMock.mockResolvedValueOnce({});
        await addOrUpdateUserPostReadingHistory("u1", "p1", 500);
        expect(upsertMock).toHaveBeenCalledTimes(1);
        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_postId: { userId: "u1", postId: "p1" } },
                update: {
                    readingLength: {
                        update: { readingLength: { increment: 500 } },
                    },
                },
            }),
        );
    });
});
