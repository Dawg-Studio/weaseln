import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts; bare
// `const mockX = vi.fn()` crashes with ReferenceError. vi.hoisted() lifts the
// declaration so the mock factory can close over it.
const { updateMock, updateManyMock, findUniqueMock, authMock } = vi.hoisted(
    () => ({
        updateMock: vi.fn(),
        updateManyMock: vi.fn(),
        findUniqueMock: vi.fn(),
        authMock: vi.fn(),
    }),
);

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        organization: {
            update: updateMock,
            updateMany: updateManyMock,
            findUnique: findUniqueMock,
        },
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { rerollSecretKey, addMember } from "@/utils/actions/organization";

beforeEach(() => {
    updateMock.mockReset();
    updateManyMock.mockReset();
    findUniqueMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "owner1" } });
});

describe("rerollSecretKey", () => {
    it("uses ownerId in the update's where clause (no separate read)", async () => {
        updateMock.mockResolvedValueOnce({ secret: "new-secret" });
        await rerollSecretKey("org1");
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "org1", ownerId: "owner1" },
            }),
        );
        expect(findUniqueMock).not.toHaveBeenCalled();
    });
});

describe("addMember", () => {
    it("uses update with OR authz in where; throws /not authorized/ on P2025", async () => {
        updateMock.mockResolvedValueOnce({ id: "org1" });
        await addMember("org1", "user2");
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: "org1",
                    OR: [
                        { ownerId: "owner1" },
                        { admins: { some: { id: "owner1" } } },
                    ],
                },
            }),
        );
        const p2025 = Object.assign(new Error("Record not found"), {
            code: "P2025",
        });
        updateMock.mockRejectedValueOnce(p2025);
        await expect(addMember("org1", "user2")).rejects.toThrow(
            /not authorized/i,
        );
    });
});
