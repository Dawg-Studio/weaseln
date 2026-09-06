import { describe, it, expect, vi } from "vitest";

const { findManyMock, findUniqueMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        postComment: { findMany: findManyMock, findUnique: findUniqueMock },
        post: { findUnique: findUniqueMock },
    },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/comment/route";

describe("GET /api/comment", () => {
    it("issues 1 findMany on postComment (no leading findUnique on Post)", async () => {
        findManyMock.mockResolvedValueOnce([]);
        const req = new NextRequest("http://localhost/api/comment?titleId=foo");
        await GET(req);
        expect(findUniqueMock).not.toHaveBeenCalled();
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { post: { titleId: "foo" } } }),
        );
    });
});