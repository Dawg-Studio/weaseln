import prisma from "@/db";
import { validateShowcaseInput } from "@/modules/portfolio/validation";
import type { ShowcaseInput, ShowcaseLayout } from "@/modules/portfolio/types";
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
