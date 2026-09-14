import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it (plan defect PD3).
const { transactionMock, findUniqueMock, updateMock, authMock } = vi.hoisted(
    () => ({
        transactionMock: vi.fn(),
        findUniqueMock: vi.fn(),
        updateMock: vi.fn(),
        authMock: vi.fn(),
    }),
);

vi.mock("@/db", () => ({
    default: {
        $transaction: transactionMock,
        user: { findUnique: findUniqueMock, update: updateMock },
    },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { toggleFollowUser } from "@/utils/actions/user";

beforeEach(() => {
    transactionMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "follower" } });
});

describe("toggleFollowUser", () => {
    it("runs read + write inside one $transaction", async () => {
        findUniqueMock.mockResolvedValueOnce({ id: "follower" });
        updateMock.mockResolvedValueOnce({});
        transactionMock.mockImplementationOnce(async (cb) =>
            cb({ user: { findUnique: findUniqueMock, update: updateMock } }),
        );

        await toggleFollowUser("followee");

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(findUniqueMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: "follower",
                    following: { some: { id: "followee" } },
                },
                select: { id: true },
            }),
        );
    });
});
