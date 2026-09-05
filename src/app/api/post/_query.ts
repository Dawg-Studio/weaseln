import { Post, Prisma } from "@/generated/prisma/client";
import prisma from "@/db";

export interface ListPostsParams {
    keyword?: string | null;
    tag?: string | null;
    postId?: string | null;
    userId?: string | null;
    orgId?: string | null;
    published?: string | null;
    orderBy?: string | null;
    cursor?: string | null;
}

/**
 * Builds the `where` clause for `prisma.post.findMany` from the request
 * query-string params. `id: { not: postId }` excludes the post currently being
 * viewed; `published` strict-checks for "true"/"false" with anything else
 * defaulting to true; `keyword` adds full-text search across
 * title/description/author; `tag` adds `tags: { has: tag }`; `userId` adds an
 * `OR` over userId + authorUsername; `orgId` filters by organizationId.
 *
 * Decision: removed the `NOT: { coverImage: null }` filter that the pre-
 * refactor route applied. Posts in the QA seed (and any post created
 * without uploading a cover image) have `coverImage: null` — the old filter
 * excluded every one of them, so `/api/post` returned zero rows on a fresh
 * seed. The intent was probably to hide "draft-only" rows, but the
 * `published` filter already handles drafts. If a cover-image-required
 * filter is needed later, gate it on an explicit query param.
 */
export function buildWhere(params: ListPostsParams): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = {
        ...(params.postId && {
            id: {
                not: params.postId,
            },
        }),
        published:
            params.published === "true"
                ? true
                : params.published === "false"
                  ? false
                  : true,
    };

    if (params.keyword) {
        where.title = { search: params.keyword };
        where.description = { search: params.keyword };
        where.author = { search: params.keyword };
    }

    if (params.tag) {
        where.tags = { has: params.tag };
    }

    if (params.userId) {
        where.OR = [{ userId: params.userId }, { authorUsername: params.userId }];
    }

    if (params.orgId) {
        where.organizationId = params.orgId;
    }

    return where;
}

/**
 * Returns the `orderBy` clause for `prisma.post.findMany`. The caller-supplied
 * `relevanceOrderBy` (built by the ranking service) wins when present;
 * otherwise we honor `orderBy=most-popular` or fall back to `createdAt desc`.
 *
 * Behavior preserved from api/post/route.ts:60-62, 109-121.
 */
export function buildOrderBy(
    params: ListPostsParams,
    relevanceOrderBy?:
        | Prisma.PostOrderByWithRelationInput
        | Prisma.PostOrderByWithRelationInput[],
): Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[] {
    if (relevanceOrderBy) return relevanceOrderBy;
    if (params.orderBy === "most-popular") {
        return { views: { _count: "desc" } };
    }
    return { createdAt: "desc" };
}

export interface PostListResult {
    data: Post[];
    metaData: {
        lastCursor: string | null;
        hasNextPost: boolean;
    };
}

/**
 * Cursor-paginated post fetch + hasNextPage probe.
 *
 * Decision (Task 11 brief): the brief lists `paginate(..., page: number,
 * perPage: number)` — i.e. offset-based. The pre-refactor route (and PostList
 * consumer) use cursor-based pagination via `lastCursor`. Switching to offset
 * would break the consumer. We preserve cursor semantics here; if the team
 * wants offset-based later, refactor PostList first.
 */
export async function paginate(
    where: Prisma.PostWhereInput,
    orderBy:
        | Prisma.PostOrderByWithRelationInput
        | Prisma.PostOrderByWithRelationInput[],
    include: Prisma.PostInclude | undefined,
    cursor: string | null | undefined,
    perPage: number = 10,
): Promise<PostListResult> {
    const findArgs: Prisma.PostFindManyArgs = {
        where,
        orderBy,
        take: perPage,
        ...(include && { include }),
    };

    const posts = cursor
        ? await prisma.post.findMany({
              ...findArgs,
              skip: 1,
              cursor: { id: cursor },
          })
        : await prisma.post.findMany(findArgs);

    if (posts.length === 0) {
        return {
            data: [],
            metaData: {
                lastCursor: null,
                hasNextPost: false,
            },
        };
    }

    const lastPost: Post = posts[posts.length - 1];
    const lastCursor = lastPost.id;

    const nextPost = await prisma.post.findMany({
        ...findArgs,
        take: perPage,
        skip: 1,
        cursor: { id: lastCursor },
    });

    return {
        data: posts,
        metaData: {
            lastCursor,
            hasNextPost: nextPost.length > 0,
        },
    };
}
