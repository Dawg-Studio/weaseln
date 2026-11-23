import { beforeEach, describe, expect, it, vi } from "vitest";

import { slugifyWithSuffix } from "@/utils/slug";
import {
    createShowcase,
    deleteShowcase,
    listShowcases,
    moveShowcase,
    updateShowcase,
} from "./service";

const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
    default: {
        portfolioShowcase: {
            create: (...args: unknown[]) => mockCreate(...args),
            updateMany: (...args: unknown[]) => mockUpdateMany(...args),
            deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
            findMany: (...args: unknown[]) => mockFindMany(...args),
            findFirst: (...args: unknown[]) => mockFindFirst(...args),
        },
        $transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

const actor = { userId: "alice" };

describe("slug helper", () => {
    it("gives a non-latin title a usable slug", () => {
        expect(slugifyWithSuffix("摄影")).toMatch(/^[a-z0-9-]+-[A-Za-z0-9_-]{4}$/);
    });

    it("gives the same title two different slugs", () => {
        expect(slugifyWithSuffix("Harbour")).not.toBe(slugifyWithSuffix("Harbour"));
    });
});

describe("showcase service", () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockUpdateMany.mockReset();
        mockDeleteMany.mockReset();
        mockFindMany.mockReset();
        mockFindFirst.mockReset();
        mockTransaction.mockReset();
        mockCreate.mockResolvedValue({ id: "s1", slug: "work-ab12" });
    });

    it("puts ownership in the where clause of the write", async () => {
        mockUpdateMany.mockResolvedValueOnce({ count: 1 });
        await updateShowcase(actor, {
            showcaseId: "s1",
            title: "Work",
            description: null,
            layout: "grid",
        });
        expect(mockUpdateMany.mock.calls[0][0].where).toEqual({
            id: "s1",
            userId: "alice",
        });
    });

    it("reports someone else's showcase as not found", async () => {
        mockUpdateMany.mockResolvedValueOnce({ count: 0 });
        await expect(
            updateShowcase(actor, {
                showcaseId: "bobs",
                title: "x",
                description: null,
                layout: "list",
            }),
        ).rejects.toThrow(/not found/i);
    });

    it("creates at the end of the owner's list with a slug", async () => {
        mockFindFirst.mockResolvedValueOnce({ order: 4 });
        const created = await createShowcase(actor, {
            title: "Photography",
            description: null,
            layout: "gallery",
        });
        expect(mockCreate.mock.calls[0][0].data.order).toBe(5);
        expect(mockCreate.mock.calls[0][0].data.userId).toBe("alice");
        expect(mockCreate.mock.calls[0][0].data.slug).toMatch(/^photography-[A-Za-z0-9_-]{4}$/);
        expect(created.id).toBe("s1");
    });

    it("refuses an invalid showcase before writing", async () => {
        await expect(
            createShowcase(actor, { title: "Work", description: null, layout: "masonry" as never }),
        ).rejects.toThrow(/layout/);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("reports someone else's showcase as not found on delete", async () => {
        mockDeleteMany.mockResolvedValueOnce({ count: 0 });
        await expect(deleteShowcase(actor, { showcaseId: "bobs" })).rejects.toThrow(/not found/i);
    });

    it("swaps order with the neighbour and does nothing at the edge", async () => {
        mockFindMany.mockResolvedValueOnce([
            { id: "a", order: 0 },
            { id: "b", order: 1 },
        ]);
        mockTransaction.mockResolvedValueOnce([]);
        await moveShowcase(actor, { showcaseId: "b", direction: -1 });
        expect(mockTransaction).toHaveBeenCalledTimes(1);

        mockFindMany.mockResolvedValueOnce([{ id: "a", order: 0 }]);
        mockTransaction.mockClear();
        await moveShowcase(actor, { showcaseId: "a", direction: -1 });
        expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("lists only the actor's showcases in order", async () => {
        mockFindMany.mockResolvedValueOnce([]);
        await listShowcases(actor);
        expect(mockFindMany.mock.calls[0][0]).toMatchObject({
            where: { userId: "alice" },
            orderBy: { order: "asc" },
        });
    });
});
