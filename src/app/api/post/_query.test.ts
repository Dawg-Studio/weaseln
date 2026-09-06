import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: vi.mock factories are hoisted, so this fn must be hoisted too to avoid a TDZ ReferenceError
const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));
vi.mock("@/db", () => ({ default: { post: { findMany: findManyMock } } }));
vi.mock("@/generated/prisma/client", () => ({
    Prisma: { PostWhereInput: class {}, PostFindManyArgs: class {} },
}));

import { paginate, buildWhere } from "@/app/api/post/_query";

beforeEach(() => findManyMock.mockReset());

describe("paginate", () => {
    it("returns empty result with no DB call when nothing matches", async () => {
        findManyMock.mockResolvedValueOnce([]);
        const res = await paginate({}, { createdAt: "desc" }, undefined, null, 10);
        expect(res).toEqual({ data: [], metaData: { lastCursor: null, hasNextPost: false } });
    });

    it("requests take = perPage + 1 to detect hasNextPost in one query", async () => {
        findManyMock.mockResolvedValueOnce(
            Array.from({ length: 11 }, (_, i) => ({ id: `p${i}` })),
        );
        await paginate({}, { createdAt: "desc" }, undefined, null, 10);
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({ take: 11 }),
        );
    });

    it("slices to perPage rows and reports hasNextPost=true when rows.length > perPage", async () => {
        findManyMock.mockResolvedValueOnce(
            Array.from({ length: 11 }, (_, i) => ({ id: `p${i}` })),
        );
        const res = await paginate({}, { createdAt: "desc" }, undefined, null, 10);
        expect(res.data).toHaveLength(10);
        expect(res.metaData.hasNextPost).toBe(true);
        expect(res.metaData.lastCursor).toBe("p9");
    });

    it("returns hasNextPost=false when rows.length === perPage (last page)", async () => {
        findManyMock.mockResolvedValueOnce(
            Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })),
        );
        const res = await paginate({}, { createdAt: "desc" }, undefined, null, 10);
        expect(res.data).toHaveLength(10);
        expect(res.metaData.hasNextPost).toBe(false);
        expect(res.metaData.lastCursor).toBe("p9");
    });

    it("passes cursor with skip: 1 when a cursor is supplied", async () => {
        findManyMock.mockResolvedValueOnce([{ id: "next" }]);
        await paginate({}, { createdAt: "desc" }, undefined, "abc", 10);
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 1, cursor: { id: "abc" } }),
        );
    });
});

describe("buildWhere", () => {
    it("keyword becomes an OR across title/description/author (not ANDed field searches)", () => {
        const w = buildWhere({ keyword: "neural" });
        expect(w.OR).toEqual([
            { title: { search: "neural" } },
            { description: { search: "neural" } },
            { author: { search: "neural" } },
        ]);
        // ponytail: separate top-level field searches would silently AND and return 0 rows
        expect((w as Record<string, unknown>).title).toBeUndefined();
        expect((w as Record<string, unknown>).description).toBeUndefined();
        expect((w as Record<string, unknown>).author).toBeUndefined();
    });

    it("no keyword → no OR clause", () => {
        const w = buildWhere({ tag: "ai" });
        expect(w.OR).toBeUndefined();
        expect(w.tags).toEqual({ has: "ai" });
    });
});