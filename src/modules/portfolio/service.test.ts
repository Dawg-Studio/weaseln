import { beforeEach, describe, expect, it, vi } from "vitest";

import { slugifyWithSuffix } from "@/utils/slug";
import {
    createExperience,
    createItem,
    createShowcase,
    deleteExperience,
    deleteItem,
    deleteShowcase,
    listExperience,
    listShowcases,
    moveExperience,
    moveItem,
    moveShowcase,
    updateExperience,
    updateItem,
    updateShowcase,
} from "./service";

const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockTransaction = vi.fn();

const mockItemCreate = vi.fn();
const mockItemUpdateMany = vi.fn();
const mockItemDeleteMany = vi.fn();
const mockItemFindMany = vi.fn();

const mockExperienceCreate = vi.fn();
const mockExperienceUpdateMany = vi.fn();
const mockExperienceDeleteMany = vi.fn();
const mockExperienceFindMany = vi.fn();

vi.mock("@/db", () => ({
    default: {
        portfolioShowcase: {
            create: (...args: unknown[]) => mockCreate(...args),
            updateMany: (...args: unknown[]) => mockUpdateMany(...args),
            deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
            findMany: (...args: unknown[]) => mockFindMany(...args),
            findFirst: (...args: unknown[]) => mockFindFirst(...args),
        },
        portfolioItem: {
            create: (...args: unknown[]) => mockItemCreate(...args),
            updateMany: (...args: unknown[]) => mockItemUpdateMany(...args),
            deleteMany: (...args: unknown[]) => mockItemDeleteMany(...args),
            findMany: (...args: unknown[]) => mockItemFindMany(...args),
        },
        userExperience: {
            create: (...args: unknown[]) => mockExperienceCreate(...args),
            updateMany: (...args: unknown[]) => mockExperienceUpdateMany(...args),
            deleteMany: (...args: unknown[]) => mockExperienceDeleteMany(...args),
            findMany: (...args: unknown[]) => mockExperienceFindMany(...args),
        },
        $transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

const actor = { userId: "alice" };

const itemInput = {
    title: "Harbour",
    summary: null,
    description: null,
    coverImage: null,
    gallery: [],
    link: null,
    tags: [],
    date: null,
};

const experienceInput = {
    kind: "work" as const,
    org: "Acme",
    role: "Engineer",
    location: null,
    startDate: "2021-01",
    endDate: null,
    isCurrent: true,
    description: null,
};

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

describe("item service", () => {
    beforeEach(() => {
        mockItemCreate.mockReset();
        mockItemUpdateMany.mockReset();
        mockItemDeleteMany.mockReset();
        mockItemFindMany.mockReset();
        mockFindFirst.mockReset();
        mockTransaction.mockReset();
        mockFindFirst.mockResolvedValue({ id: "s1" });
        mockItemCreate.mockImplementation((args: { data: { slug: string } }) => ({
            id: "i1",
            slug: args.data.slug,
        }));
        mockItemFindMany.mockResolvedValue([]);
        mockTransaction.mockResolvedValue([]);
    });

    it("scopes an item write through its showcase owner", async () => {
        mockItemUpdateMany.mockResolvedValueOnce({ count: 1 });
        await updateItem(actor, { itemId: "i1", ...itemInput });
        expect(mockItemUpdateMany.mock.calls[0][0].where).toEqual({
            id: "i1",
            showcase: { userId: "alice" },
        });
    });

    it("refuses to create an item in someone else's showcase", async () => {
        mockFindFirst.mockResolvedValueOnce(null);
        await expect(
            createItem(actor, { showcaseId: "bobs", ...itemInput }),
        ).rejects.toThrow(/not found/i);
        expect(mockItemCreate).not.toHaveBeenCalled();
    });

    it("gives same-titled items distinct slugs", async () => {
        mockItemFindMany.mockResolvedValue([]);
        const a = await createItem(actor, { showcaseId: "s1", ...itemInput });
        const b = await createItem(actor, { showcaseId: "s1", ...itemInput });
        expect(a.slug).not.toBe(b.slug);
    });

    it("refuses the 13th gallery image before writing", async () => {
        const gallery = Array.from(
            { length: 13 },
            (_, i) => `https://res.cloudinary.com/leindfraust/image/upload/v1/p/${i}.jpg`,
        );
        await expect(
            createItem(actor, { showcaseId: "s1", ...itemInput, gallery }),
        ).rejects.toThrow(/12/);
        expect(mockItemCreate).not.toHaveBeenCalled();
    });

    it("reports someone else's item as not found on delete", async () => {
        mockItemDeleteMany.mockResolvedValueOnce({ count: 0 });
        await expect(deleteItem(actor, { itemId: "bobs" })).rejects.toThrow(/not found/i);
    });

    it("swaps an item with its neighbour in the same showcase", async () => {
        mockItemFindMany.mockReset();
        mockItemFindMany.mockResolvedValueOnce([
            { id: "i1", order: 0, showcaseId: "s1" },
            { id: "i2", order: 1, showcaseId: "s1" },
        ]);
        await moveItem(actor, { itemId: "i2", direction: -1 });
        expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it("never moves an item across showcases", async () => {
        mockItemFindMany.mockReset();
        mockItemFindMany.mockResolvedValueOnce([
            { id: "i1", order: 0, showcaseId: "s1" },
            { id: "i2", order: 1, showcaseId: "s2" },
        ]);
        await moveItem(actor, { itemId: "i2", direction: -1 });
        expect(mockTransaction).not.toHaveBeenCalled();
    });
});

describe("experience service", () => {
    beforeEach(() => {
        mockExperienceCreate.mockReset();
        mockExperienceUpdateMany.mockReset();
        mockExperienceDeleteMany.mockReset();
        mockExperienceFindMany.mockReset();
        mockExperienceCreate.mockResolvedValue({ id: "e1" });
        mockExperienceFindMany.mockResolvedValue([]);
        mockTransaction.mockResolvedValue([]);
    });

    it("scopes the update to the actor", async () => {
        mockExperienceUpdateMany.mockResolvedValueOnce({ count: 1 });
        await updateExperience(actor, { experienceId: "e1", ...experienceInput });
        expect(mockExperienceUpdateMany.mock.calls[0][0].where).toEqual({
            id: "e1",
            userId: "alice",
        });
    });

    it("reports an unknown experience row as not found", async () => {
        mockExperienceDeleteMany.mockResolvedValueOnce({ count: 0 });
        await expect(deleteExperience(actor, { experienceId: "x" })).rejects.toThrow(/not found/i);
    });

    it("refuses isCurrent with an endDate", async () => {
        await expect(
            createExperience(actor, { ...experienceInput, endDate: "2024-01" }),
        ).rejects.toThrow(/isCurrent/);
        expect(mockExperienceCreate).not.toHaveBeenCalled();
    });

    it("lists experience in order", async () => {
        mockExperienceFindMany.mockResolvedValueOnce([]);
        await listExperience(actor);
        expect(mockExperienceFindMany.mock.calls[0][0]).toMatchObject({
            where: { userId: "alice" },
            orderBy: { order: "asc" },
        });
    });

    it("swaps experience order with the neighbour", async () => {
        mockExperienceFindMany.mockResolvedValueOnce([
            { id: "e1", order: 0 },
            { id: "e2", order: 1 },
        ]);
        await moveExperience(actor, { experienceId: "e2", direction: -1 });
        expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
});
