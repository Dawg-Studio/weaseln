import { cache } from "react";
import prisma from "@/db";
import { auth } from "@/auth";
import { postContainerInclude } from "@/utils/prismaQuery";

export const getSessionUser = cache(async () => {
    const session = await auth();
    if (!session?.user) return null;
    return prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, username: true, image: true, email: true },
    });
});

export const getProfile = cache(async (userId: string) =>
    prisma.user.findFirst({
        where: { OR: [{ id: userId }, { username: userId }] },
        include: {
            profileCustomization: true,
            organizations: {
                select: { id: true, name: true, username: true, image: true },
            },
            _count: {
                select: { post: true, following: true, followedBy: true },
            },
        },
    }),
);

export const getPost = cache(async (slug: string) =>
    prisma.post.findUnique({
        where: { titleId: slug },
        include: {
            user: { select: { id: true, username: true, name: true, image: true } },
            _count: { select: { reactions: true, views: true } },
            organization: { select: { id: true, name: true } },
        },
    }),
);

export const getSeries = cache(async (userId: string, slug: string) =>
    prisma.postSeries.findFirst({
        where: { id: slug, author: { OR: [{ id: userId }, { username: userId }] } },
        include: {
            author: { select: { name: true } },
            posts: { where: { published: true }, include: postContainerInclude },
        },
    }),
);

// ponytail: same query body as src/app/api/tag/route.ts GET — distinct post tags
// unioned with the curated default_tags list, deduped and sorted. /new and /edit
// call this loader directly (T19); the /api/tag route handler is now dead and a
// candidate for removal in Layer 6.
export const getAllTags = cache(async (): Promise<string[]> => {
    const default_tags = [
        "travel",
        "food",
        "lifestyle",
        "fashion",
        "beauty",
        "health",
        "fitness",
        "technology",
        "business",
        "finance",
        "parenting",
        "education",
        "photography",
        "art",
        "books",
        "movies",
        "music",
        "crafts",
        "diy",
        "gardening",
        "home",
        "inspiration",
        "motivation",
        "personal",
        "productivity",
        "relationships",
        "self-improvement",
        "sustainability",
        "weddings",
        "celebrities",
        "culture",
        "humor",
        "sports",
    ];
    const distinct = await prisma.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT tag FROM posts."Post", unnest(tags) AS tag`;
    const tags = distinct.map((d) => d.tag).concat(default_tags ?? []);
    return Array.from(new Set(tags)).sort();
});
