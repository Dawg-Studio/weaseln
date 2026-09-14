import { describe, it, expect, vi } from "vitest";

const { queryRawMock, findManyMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    findManyMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        $queryRaw: queryRawMock,
        post: { findMany: findManyMock },
        tagsRanking: { findFirst: vi.fn() },
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { GET } from "@/app/api/tag/route";

describe("GET /api/tag", () => {
    it("issues exactly one $queryRaw for distinct tags and no prisma.post.findMany", async () => {
        queryRawMock.mockResolvedValueOnce([{ tag: "ai" }, { tag: "rust" }]);
        await GET();
        expect(queryRawMock).toHaveBeenCalledTimes(1);
        expect(findManyMock).not.toHaveBeenCalled();
    });
});
