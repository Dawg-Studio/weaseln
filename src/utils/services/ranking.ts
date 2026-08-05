import prisma from "@/db";
import { TagRank } from "@/types/tag";

// ponytail: this file is the unified ranking service (Task 11, B6+B9). Three
// pre-refactor implementations now route through it:
//   - api/post/route.ts relevance branch  -> rankContentForUser
//   - utils/actions/tag.ts getTagRankings -> rankTagsForUser(null, {limit})
//   - api/cron/route.ts tagRanks()        -> computeTagRankings (write side)

export type RankedTag = {
    tag: string;
    score: number;
    usage?: number;
    followers?: number;
};

export interface RankTagsForUserOpts {
    limit?: number;
}

/**
 * Decision (Task 11 brief, B6+B9): the canonical ranking output is the union
 * of what the three pre-refactor implementations need. Authenticated users
 * rank from their own data (interests + readingHistory + postReactions);
 * anonymous visitors rank from the persisted TagsRanking row so the
 * `getTagRankings` server action can cast back to TagRank[] without losing
 * `usage` / `followers`.
 */
export async function rankTagsForUser(
    userId: string | null | undefined,
    opts?: RankTagsForUserOpts,
): Promise<RankedTag[]> {
    const limit = opts?.limit;
    if (userId) {
        const ranked = await rankFromUserData(userId);
        return limit !== undefined ? ranked.slice(0, limit) : ranked;
    }
    const ranked = await rankFromTagsRanking();
    return limit !== undefined ? ranked.slice(0, limit) : ranked;
}

export interface RankedContent {
    tags: string[];
    titles: string[];
    authors: string[];
}

interface CollectedContent {
    tagsRaw: string[];
    titles: string[];
    authors: string[];
}

export interface RankContentForUserOpts {
    postId?: string | null;
}

/**
 * ponytail: this function preserves the pre-refactor relevance algorithm
 * verbatim, including two known quirks documented as "Concern #1" in
 * .superpowers/sdd/2026-08-05-resolve-concerns/task-11-report.md:
 *
 *   - tagCount.push({tag, count}) accumulates per-occurrence instead of
 *     deduping. The count field reflects the FIRST matching entry's count
 *     (find() returns the first match), not the true tag frequency. The
 *     downstream `[...new Set(...)]` in the route dedups the search
 *     string back to one term per tag.
 *
 *   - sort((a,b) => b.count - a.count).slice(-10) returns the BOTTOM 10
 *     by count (last 10 after descending sort), not the top 10. The
 *     intent was almost certainly `slice(0, 10)`; flagged as a follow-up.
 *
 * Also preserves the pre-refactor `currentPost.tags` inclusion that the
 * original route had (appended to the `tags` array) but my first refactor
 * accidentally dropped.
 *
 * Do NOT "fix" any of these without a separate change request.
 *
 * Decision (Task 11 brief): returns the relevance set consumed by the
 * route's `_relevance` search. Authenticated users get tags+titles+authors
 * from their own data; anonymous visitors get tags+titles+authors from the
 * persisted TagsRanking + top 100 posts. `postId` always appends the current
 * post's title/desc/author/tags regardless of session.
 */
export async function rankContentForUser(
    userId: string | null | undefined,
    opts?: RankContentForUserOpts,
): Promise<RankedContent> {
    const postId = opts?.postId;
    const collected = userId
        ? await collectContentFromUser(userId, postId)
        : await collectContentFromGlobal(postId);
    return {
        tags: rankTagsBottom10(collected.tagsRaw),
        titles: collected.titles,
        authors: collected.authors,
    };
}

function rankTagsBottom10(tagsRaw: string[]): string[] {
    const tagCount: { tag: string; count: number }[] = [];
    tagsRaw.forEach((tag) => {
        tagCount.push({
            tag,
            count:
                (tagCount.find((count) => count.tag === tag)?.count || 0) + 1,
        });
    });
    if (tagCount.length >= 10) {
        return tagCount
            .sort((a, b) => b.count - a.count)
            .slice(-10)
            .map((t) => t.tag);
    }
    return tagCount
        .sort((a, b) => b.count - a.count)
        .map((t) => t.tag);
}

export async function computeTagRankings(): Promise<TagRank[]> {
    const posts = await prisma.post.findMany();
    const tags: string[] = [];
    posts.forEach((post) => post.tags.forEach((tag) => tags.push(tag)));

    const setTags = [...new Set(tags)];
    const tagRanking: TagRank[] = [];
    for (const setTag of setTags) {
        const tagFollowers = await prisma.user.count({
            where: {
                interests: {
                    has: setTag,
                },
            },
        });
        tagRanking.push({
            tag: setTag,
            usage: tags.filter((tag) => tag === setTag).length,
            followers: tagFollowers,
        });
    }
    return tagRanking;
}

async function rankFromUserData(userId: string): Promise<RankedTag[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            readingHistory: {
                take: 100,
                include: {
                    post: true,
                },
                orderBy: [
                    {
                        readingLength: {
                            readingLength: "desc",
                        },
                    },
                    {
                        updatedAt: "desc",
                    },
                ],
            },
            postReactions: {
                take: 100,
                include: {
                    post: true,
                },
                orderBy: {
                    updatedAt: "desc",
                },
            },
        },
    });

    const tagCounts = new Map<string, number>();
    const bump = (tag: string) =>
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

    user?.interests?.forEach(bump);
    user?.readingHistory.forEach((history) => {
        history.post.tags.forEach(bump);
    });
    user?.postReactions.forEach((postReact) => {
        postReact.post.tags.forEach(bump);
    });

    return [...tagCounts.entries()]
        .map(([tag, score]) => ({ tag, score }))
        .sort((a, b) => b.score - a.score);
}

async function rankFromTagsRanking(): Promise<RankedTag[]> {
    const tagsRanking = await prisma.tagsRanking.findFirst({
        orderBy: {
            createdAt: "desc",
        },
    });
    const data = (tagsRanking?.data as TagRank[] | undefined) ?? [];
    return data.map((t) => ({
        tag: t.tag,
        score: t.usage,
        usage: t.usage,
        followers: t.followers,
    }));
}

async function collectContentFromUser(
    userId: string,
    postId?: string | null,
): Promise<CollectedContent> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            readingHistory: {
                take: 100,
                include: {
                    post: true,
                },
                orderBy: [
                    {
                        readingLength: {
                            readingLength: "desc",
                        },
                    },
                    {
                        updatedAt: "desc",
                    },
                ],
            },
            postReactions: {
                take: 100,
                include: {
                    post: true,
                },
                orderBy: {
                    updatedAt: "desc",
                },
            },
        },
    });

    const tagsRaw: string[] = [...(user?.interests ?? [])];
    const titles: string[] = [];
    const authors: string[] = [];

    user?.readingHistory.forEach((history) => {
        tagsRaw.push(...history.post.tags);
        titles.push(history.post.title.toLowerCase());
        titles.push(history.post.description.toLowerCase());
        authors.push(history.post.author);
    });
    user?.postReactions.forEach((postReact) => {
        tagsRaw.push(...postReact.post.tags);
        titles.push(postReact.post.title.toLowerCase());
        titles.push(postReact.post.description.toLowerCase());
        authors.push(postReact.post.author);
    });

    await appendPostTerms(postId, tagsRaw, titles, authors);

    return { tagsRaw, titles, authors };
}

async function collectContentFromGlobal(
    postId?: string | null,
): Promise<CollectedContent> {
    const tagsRanking = await prisma.tagsRanking.findFirst({
        orderBy: {
            createdAt: "desc",
        },
    });
    const tagRanks = ((tagsRanking?.data as TagRank[] | undefined) ?? []).map(
        (tagRank) => tagRank.tag,
    );

    const topPosts = await prisma.post.findMany({
        take: 100,
        orderBy: [
            {
                views: {
                    _count: "desc",
                },
            },
            {
                postReadingHistories: {
                    _count: "desc",
                },
            },
            {
                postReadingLength: {
                    _count: "desc",
                },
            },
            {
                reactions: {
                    _count: "desc",
                },
            },
            {
                activities: {
                    _count: "desc",
                },
            },
            {
                updatedAt: "desc",
            },
        ],
    });

    const tagsRaw: string[] = [];
    const titles: string[] = [];
    const authors: string[] = [];

    topPosts.forEach((post) => {
        tagsRaw.push(...post.tags, ...tagRanks);
        titles.push(post.title.toLowerCase());
        titles.push(post.description.toLowerCase());
        authors.push(post.author);
    });

    await appendPostTerms(postId, tagsRaw, titles, authors);

    return { tagsRaw, titles, authors };
}

async function appendPostTerms(
    postId: string | null | undefined,
    tagsRaw: string[],
    titles: string[],
    authors: string[],
): Promise<void> {
    if (!postId) return;
    const currentPost = await prisma.post.findUnique({
        where: {
            id: postId,
        },
    });
    if (!currentPost) return;
    if (currentPost.title) titles.push(currentPost.title.toLowerCase());
    if (currentPost.description)
        titles.push(currentPost.description.toLowerCase());
    if (currentPost.author) authors.push(currentPost.author);
    if (currentPost?.tags && currentPost.tags.length > 0) {
        for (const currentPostTag of currentPost.tags) {
            tagsRaw.push(currentPostTag);
        }
    }
}
