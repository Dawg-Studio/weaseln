import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it.
const { upsertMock, updateMock, deleteMock, transactionMock, authMock } = vi.hoisted(
    () => ({
        upsertMock: vi.fn(),
        updateMock: vi.fn(),
        deleteMock: vi.fn(),
        transactionMock: vi.fn(),
        authMock: vi.fn(),
    }),
);

vi.mock("@/db", () => ({
    default: {
        emailVerificationCode: { upsert: upsertMock, delete: deleteMock },
        user: { update: updateMock },
        $transaction: transactionMock,
    },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { generateVerificationCode, verifyEmail } from "@/utils/actions/verification";

beforeEach(() => {
    upsertMock.mockReset();
    updateMock.mockReset();
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
    it("runs user.update + emailVerificationCode.delete in one $transaction", async () => {
        transactionMock.mockImplementationOnce(async (ops: Promise<unknown>[]) => Promise.all(ops));
        await verifyEmail("user1", "code-abc");
        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "user1" } }),
        );
        expect(deleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "user1" } }),
        );
    });
});
