import prisma from "@/db";
import {
    validateExperienceInput,
    validateItemInput,
    validateShowcaseInput,
} from "@/modules/portfolio/validation";
import type {
    ExperienceInput,
    ItemInput,
    ShowcaseInput,
    ShowcaseLayout,
} from "@/modules/portfolio/types";
import { slugifyWithSuffix } from "@/utils/slug";

export type PortfolioActor = { userId: string };

export type ShowcaseRow = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    layout: ShowcaseLayout;
    order: number;
};

export async function listShowcases(
    actor: PortfolioActor,
): Promise<ShowcaseRow[]> {
    return prisma.portfolioShowcase.findMany({
        where: { userId: actor.userId },
        orderBy: { order: "asc" },
        select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            layout: true,
            order: true,
        },
    }) as Promise<ShowcaseRow[]>;
}

export async function createShowcase(
    actor: PortfolioActor,
    input: ShowcaseInput,
): Promise<{ id: string; slug: string }> {
    const data = validateShowcaseInput(input);
    const last = await prisma.portfolioShowcase.findFirst({
        where: { userId: actor.userId },
        orderBy: { order: "desc" },
        select: { order: true },
    });

    return prisma.portfolioShowcase.create({
        data: {
            ...data,
            userId: actor.userId,
            slug: slugifyWithSuffix(data.title),
            order: (last?.order ?? -1) + 1,
        },
        select: { id: true, slug: true },
    });
}

/**
 * The slug is generated once, at creation, and never regenerated: editing a
 * title must not break a link someone already shared.
 */
export async function updateShowcase(
    actor: PortfolioActor,
    args: { showcaseId: string } & ShowcaseInput,
): Promise<void> {
    const { showcaseId, ...input } = args;
    const data = validateShowcaseInput(input);
    const { count } = await prisma.portfolioShowcase.updateMany({
        where: { id: showcaseId, userId: actor.userId },
        data,
    });
    if (count === 0) throw new Error("Showcase not found");
}

export async function deleteShowcase(
    actor: PortfolioActor,
    args: { showcaseId: string },
): Promise<void> {
    const { count } = await prisma.portfolioShowcase.deleteMany({
        where: { id: args.showcaseId, userId: actor.userId },
    });
    if (count === 0) throw new Error("Showcase not found");
}

/**
 * Up/down ordering swaps with the neighbour in the owner's own list, so an id
 * belonging to someone else is simply absent and the call does nothing.
 */
export async function moveShowcase(
    actor: PortfolioActor,
    args: { showcaseId: string; direction: -1 | 1 },
): Promise<void> {
    const rows = await prisma.portfolioShowcase.findMany({
        where: { userId: actor.userId },
        orderBy: { order: "asc" },
        select: { id: true, order: true },
    });

    const index = rows.findIndex((row) => row.id === args.showcaseId);
    if (index === -1) return;

    const neighbour = rows[index + args.direction];
    if (!neighbour) return;

    const current = rows[index];
    await prisma.$transaction([
        prisma.portfolioShowcase.updateMany({
            where: { id: current.id, userId: actor.userId },
            data: { order: neighbour.order },
        }),
        prisma.portfolioShowcase.updateMany({
            where: { id: neighbour.id, userId: actor.userId },
            data: { order: current.order },
        }),
    ]);
}

export type ItemRow = ItemInput & { id: string; slug: string; order: number };

export type ExperienceRow = ExperienceInput & { id: string; order: number };

async function assertOwnsShowcase(
    actor: PortfolioActor,
    showcaseId: string,
): Promise<void> {
    const showcase = await prisma.portfolioShowcase.findFirst({
        where: { id: showcaseId, userId: actor.userId },
        select: { id: true },
    });
    if (!showcase) throw new Error("Showcase not found");
}

async function nextOrder(
    existing: { order: number }[],
): Promise<number> {
    const highest = existing[0]?.order ?? -1;
    return highest + 1;
}

export async function createItem(
    actor: PortfolioActor,
    args: { showcaseId: string } & ItemInput,
): Promise<{ id: string; slug: string }> {
    const { showcaseId, ...input } = args;
    const data = validateItemInput(input);
    await assertOwnsShowcase(actor, showcaseId);

    const last = await prisma.portfolioItem.findMany({
        where: { showcaseId },
        orderBy: { order: "desc" },
        take: 1,
        select: { order: true },
    });

    return prisma.portfolioItem.create({
        data: {
            ...data,
            showcaseId,
            slug: slugifyWithSuffix(data.title),
            order: await nextOrder(last),
        },
        select: { id: true, slug: true },
    });
}

export async function updateItem(
    actor: PortfolioActor,
    args: { itemId: string } & ItemInput,
): Promise<void> {
    const { itemId, ...input } = args;
    const data = validateItemInput(input);
    const { count } = await prisma.portfolioItem.updateMany({
        where: { id: itemId, showcase: { userId: actor.userId } },
        data,
    });
    if (count === 0) throw new Error("Item not found");
}

export async function deleteItem(
    actor: PortfolioActor,
    args: { itemId: string },
): Promise<void> {
    const { count } = await prisma.portfolioItem.deleteMany({
        where: { id: args.itemId, showcase: { userId: actor.userId } },
    });
    if (count === 0) throw new Error("Item not found");
}

/**
 * Loads the owner's items once and finds the target's neighbours inside the
 * same showcase, so an id belonging to someone else is simply absent.
 */
export async function moveItem(
    actor: PortfolioActor,
    args: { itemId: string; direction: -1 | 1 },
): Promise<void> {
    const rows = await prisma.portfolioItem.findMany({
        where: { showcase: { userId: actor.userId } },
        orderBy: [{ showcaseId: "asc" }, { order: "asc" }],
        select: { id: true, order: true, showcaseId: true },
    });

    const index = rows.findIndex((row) => row.id === args.itemId);
    if (index === -1) return;

    const current = rows[index];
    const neighbour = rows[index + args.direction];
    if (!neighbour || neighbour.showcaseId !== current.showcaseId) return;

    await prisma.$transaction([
        prisma.portfolioItem.updateMany({
            where: { id: current.id, showcase: { userId: actor.userId } },
            data: { order: neighbour.order },
        }),
        prisma.portfolioItem.updateMany({
            where: { id: neighbour.id, showcase: { userId: actor.userId } },
            data: { order: current.order },
        }),
    ]);
}

export async function listExperience(
    actor: PortfolioActor,
): Promise<ExperienceRow[]> {
    return prisma.userExperience.findMany({
        where: { userId: actor.userId },
        orderBy: { order: "asc" },
        select: {
            id: true,
            kind: true,
            org: true,
            role: true,
            location: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
            description: true,
            order: true,
        },
    }) as Promise<ExperienceRow[]>;
}

export async function createExperience(
    actor: PortfolioActor,
    input: ExperienceInput,
): Promise<{ id: string }> {
    const data = validateExperienceInput(input);
    const last = await prisma.userExperience.findMany({
        where: { userId: actor.userId },
        orderBy: { order: "desc" },
        take: 1,
        select: { order: true },
    });

    return prisma.userExperience.create({
        data: { ...data, userId: actor.userId, order: await nextOrder(last) },
        select: { id: true },
    });
}

export async function updateExperience(
    actor: PortfolioActor,
    args: { experienceId: string } & ExperienceInput,
): Promise<void> {
    const { experienceId, ...input } = args;
    const data = validateExperienceInput(input);
    const { count } = await prisma.userExperience.updateMany({
        where: { id: experienceId, userId: actor.userId },
        data,
    });
    if (count === 0) throw new Error("Experience not found");
}

export async function deleteExperience(
    actor: PortfolioActor,
    args: { experienceId: string },
): Promise<void> {
    const { count } = await prisma.userExperience.deleteMany({
        where: { id: args.experienceId, userId: actor.userId },
    });
    if (count === 0) throw new Error("Experience not found");
}

export async function moveExperience(
    actor: PortfolioActor,
    args: { experienceId: string; direction: -1 | 1 },
): Promise<void> {
    const rows = await prisma.userExperience.findMany({
        where: { userId: actor.userId },
        orderBy: { order: "asc" },
        select: { id: true, order: true },
    });

    const index = rows.findIndex((row) => row.id === args.experienceId);
    if (index === -1) return;

    const neighbour = rows[index + args.direction];
    if (!neighbour) return;

    const current = rows[index];
    await prisma.$transaction([
        prisma.userExperience.updateMany({
            where: { id: current.id, userId: actor.userId },
            data: { order: neighbour.order },
        }),
        prisma.userExperience.updateMany({
            where: { id: neighbour.id, userId: actor.userId },
            data: { order: current.order },
        }),
    ]);
}
