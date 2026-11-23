import { randomBytes } from "crypto";

import prisma from "@/db";
import { Prisma } from "@/generated/prisma/client";
import {
    validatePostCustomizationInput,
} from "@/modules/post-customization/validation";

export type PostActor = { userId: string };

export type PostSummary = {
    id: string;
    title: string;
    titleId: string;
    published: boolean;
    createdAt: Date;
    authorUsername: string | null;
    organizationId: string | null;
};

export type CreatePostInput = {
    title: string;
    description: string;
    content: unknown;
    tags: string[];
    readPerMinute: number;
    published: boolean;
    organizationId?: string | null;
    /**
     * The four design fields, unvalidated. They are validated here because a
     * value that arrives from a request or a model is never typed.
     */
    customization?: unknown;
    /** An allowlisted cover image URL. */
    coverImage?: string | null;
};

export type UpdatePostInput = CreatePostInput & { postId: string };

export type PostSort =
    | "recent"
    | "unpublished"
    | "most-views"
    | "most-reactions"
    | "most-comments";

export type ListPostsFilters = {
    published?: boolean;
    organizationId?: string;
    q?: string;
    cursor?: string;
    sort?: PostSort;
};

/**
 * A row that does not exist is how Prisma reports "the predicate you gave me
 * matched nothing" — which for these writes means "not yours".
 */
function isNotFound(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2025"
    );
}

function generateTitleId(title: string): string {
    const slug = title
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim()
        .split(" ")
        .join("-");
    const suffix = randomBytes(2).toString("base64url").slice(0, 4);
    return `${slug}-${suffix}`;
}

/**
 * The four customization columns are scalars, so a partial payload contributes
 * only the keys it names. An absent payload contributes none, which leaves an
 * existing row's background alone.
 */
function postData(input: CreatePostInput) {
    const customization = input.customization
        ? validatePostCustomizationInput(input.customization)
        : {};
    return {
        title: input.title,
        description: input.description,
        content: input.content as Prisma.InputJsonValue,
        tags: input.tags,
        readPerMinute: input.readPerMinute,
        published: input.published,
        ...(input.coverImage && { coverImage: input.coverImage }),
        ...customization,
    };
}

export async function createPost(
    actor: PostActor,
    input: CreatePostInput,
): Promise<{ id: string; titleId: string; content: unknown }> {
    const author = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { name: true, image: true, username: true },
    });
    try {
        const post = await prisma.post.create({
            data: {
                ...postData(input),
                author: author?.name ?? "",
                authorImage: author?.image ?? "",
                authorUsername: author?.username ?? null,
                titleId: generateTitleId(input.title),
                user: { connect: { id: actor.userId } },
                ...(input.organizationId && {
                    organization: { connect: { id: input.organizationId } },
                }),
            },
            select: { id: true, content: true, titleId: true },
        });
        return { id: post.id, titleId: post.titleId, content: post.content };
    } catch (error) {
        if (isNotFound(error)) throw new Error("Not authorized");
        throw error;
    }
}

export async function updatePost(
    actor: PostActor,
    input: UpdatePostInput,
): Promise<{ id: string; titleId: string; content: unknown }> {
    try {
        const post = await prisma.post.update({
            // The owner predicate stays on the mutation itself, so a concurrent
            // ownership change cannot reopen the hole.
            where: { id: input.postId, userId: actor.userId },
            data: {
                ...postData(input),
                ...(input.organizationId && {
                    organization: { connect: { id: input.organizationId } },
                }),
            },
            select: { id: true, content: true, titleId: true },
        });
        return { id: post.id, titleId: post.titleId, content: post.content };
    } catch (error) {
        if (isNotFound(error)) throw new Error("Not authorized");
        throw error;
    }
}

export async function listPosts(
    actor: PostActor,
    filters: ListPostsFilters,
): Promise<PostSummary[]> {
    const where: Prisma.PostWhereInput = {
        userId: actor.userId,
        ...(filters.published !== undefined && { published: filters.published }),
        ...(filters.organizationId && {
            organizationId: filters.organizationId,
        }),
        ...(filters.q && {
            OR: [
                { title: { contains: filters.q, mode: "insensitive" } },
                {
                    description: {
                        contains: filters.q,
                        mode: "insensitive",
                    },
                },
            ],
        }),
    };

    let orderBy: Prisma.PostOrderByWithRelationInput = { createdAt: "desc" };
    if (filters.sort === "unpublished") {
        where.published = false;
    } else if (filters.sort === "most-views") {
        orderBy = { views: { _count: "desc" } };
    } else if (filters.sort === "most-reactions") {
        orderBy = { reactions: { _count: "desc" } };
    } else if (filters.sort === "most-comments") {
        orderBy = { comments: { _count: "desc" } };
    }

    return prisma.post.findMany({
        where,
        orderBy,
        take: 50,
        ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
        select: {
            id: true,
            title: true,
            titleId: true,
            published: true,
            createdAt: true,
            authorUsername: true,
            organizationId: true,
        },
    });
}

export async function setPostPublished(
    actor: PostActor,
    input: { postId: string; published: boolean },
): Promise<void> {
    try {
        await prisma.post.update({
            where: { id: input.postId, userId: actor.userId },
            data: { published: input.published },
        });
    } catch (error) {
        if (isNotFound(error)) throw new Error("Not authorized");
        throw error;
    }
}

export async function deletePost(
    actor: PostActor,
    input: { postId: string },
): Promise<void> {
    try {
        await prisma.post.delete({
            where: { id: input.postId, userId: actor.userId },
        });
    } catch (error) {
        if (isNotFound(error)) throw new Error("Not authorized");
        throw error;
    }
}

/**
 * The four design columns on their own, so a design change does not have to
 * carry the whole post.
 */
export async function setPostCustomization(
    actor: PostActor,
    input: { postId: string; customization: unknown },
): Promise<void> {
    const customization = validatePostCustomizationInput(input.customization);
    try {
        await prisma.post.update({
            where: { id: input.postId, userId: actor.userId },
            data: { ...customization },
        });
    } catch (error) {
        if (isNotFound(error)) throw new Error("Not authorized");
        throw error;
    }
}

/**
 * A post is readable when the caller wrote it, when it belongs to an
 * organization the caller belongs to, or when it is published, which the
 * public site already serves to anyone.
 */
export async function getPost(
    actor: PostActor,
    input: { postId: string },
): Promise<{
    id: string;
    title: string;
    description: string;
    tags: string[];
    content: unknown;
    published: boolean;
    organizationId: string | null;
    authorUsername: string | null;
    createdAt: Date;
}> {
    const post = await prisma.post.findUnique({
        where: { id: input.postId },
        select: {
            id: true,
            title: true,
            description: true,
            tags: true,
            content: true,
            published: true,
            organizationId: true,
            authorUsername: true,
            createdAt: true,
            userId: true,
            organization: {
                select: {
                    ownerId: true,
                    admins: { select: { id: true } },
                    members: { select: { id: true } },
                },
            },
        },
    });
    if (!post) throw new Error("Post not found");

    const authored = post.userId === actor.userId;
    const inOrganization = post.organization
        ? post.organization.ownerId === actor.userId ||
          post.organization.admins.some(
              (admin) => admin.id === actor.userId,
          ) ||
          post.organization.members.some(
              (member) => member.id === actor.userId,
          )
        : false;
    if (!authored && !inOrganization && !post.published) {
        throw new Error("Post not found");
    }

    return {
        id: post.id,
        title: post.title,
        description: post.description,
        tags: post.tags,
        content: post.content,
        published: post.published,
        organizationId: post.organizationId,
        authorUsername: post.authorUsername,
        createdAt: post.createdAt,
    };
}
