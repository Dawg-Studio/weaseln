import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it.
const { upsertMock, updateManyMock, deleteMock, transactionMock, authMock } = vi.hoisted(
    () => ({
        upsertMock: vi.fn(),
        updateManyMock: vi.fn(),
        deleteMock: vi.fn(),
        transactionMock: vi.fn(),
        authMock: vi.fn(),
    }),
);

vi.mock("@/db", () => ({
    default: {
        emailVerificationCode: { upsert: upsertMock, delete: deleteMock },
        user: { updateMany: updateManyMock },
        $transaction: transactionMock,
    },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { generateVerificationCode, verifyEmail } from "@/utils/actions/verification";

beforeEach(() => {
    upsertMock.mockReset();
    updateManyMock.mockReset();
    deleteMock.mockReset();
    transactionMock.mockReset();
});

describe("generateVerificationCode", () => {
    it("issues exactly one upsert", async () => {
        upsertMock.mockResolvedValueOnce({});
        await generateVerificationCode("user1");
        expect(upsertMock).toHaveBeenCalledTimes(1);
        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "user1" } }),
        );
    });
});

describe("verifyEmail", () => {
    it("marks user verified + deletes code when key matches", async () => {
        updateManyMock.mockResolvedValueOnce({ count: 1 });
        await verifyEmail("user1", "code-abc");
        expect(updateManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user1", emailVerificationCode: { key: "code-abc" } },
                data: expect.objectContaining({ emailVerified: expect.any(Date) }),
            }),
        );
        expect(deleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "user1" } }),
        );
    });

    it("throws and does not delete when the code does not match", async () => {
        updateManyMock.mockResolvedValueOnce({ count: 0 });
        await expect(verifyEmail("user1", "wrong")).rejects.toThrow(
            "Invalid or expired verification code",
        );
        expect(deleteMock).not.toHaveBeenCalled();
    });
});
