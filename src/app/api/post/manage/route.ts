import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

import prisma from "@/db";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const sort = url.searchParams.get("sort") as
        | "recent"
        | "unpublished"
        | "most-views"
        | "most-reactions"
        | "most-comments";

    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    interface PrismaQuery {
        where: {
            userId: string;
            published?: boolean;
        };
        orderBy: {};
    }

    const prismaQuery: PrismaQuery = {
        where: {
            userId: session.user.id,
        },
        orderBy: {
            createdAt: "desc", // default sorting is it's recent creation
        },
    };
    if (sort === "recent") {
        prismaQuery.orderBy = {
            createdAt: "desc",
        };
    }

    if (sort === "unpublished") {
        prismaQuery.where.published = false;
    }

    if (sort === "most-views") {
        prismaQuery.orderBy = {
            views: {
                _count: "desc",
            },
        };
    }

    if (sort === "most-reactions") {
        prismaQuery.orderBy = {
            reactions: {
                _count: "desc",
            },
        };
    }

    if (sort === "most-comments") {
        prismaQuery.orderBy = {
            comments: {
                _count: "desc",
            },
        };
    }

    try {
        const cursor = url.searchParams.get("cursor");
        const posts = await prisma.post.findMany({
            ...prismaQuery,
            take: 50,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            select: {
                id: true,
                authorUsername: true,
                userId: true,
                title: true,
                titleId: true,
                published: true,
            },
        });
        return NextResponse.json(
            { data: posts, lastCursor: posts.at(-1)?.id ?? null },
            { status: 200 },
        );
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const postId = url.searchParams.get("postId");
    const publish = url.searchParams.get("publish") as "true" | "false";

    if (!postId) {
        return NextResponse.json(
            { error: "postId is required" },
            { status: 400 },
        );
    }

    try {
        const existing = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!existing) {
            return NextResponse.json(
                { error: "Post not found" },
                { status: 404 },
            );
        }
        if (existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.post.update({
            // Keep the owner predicate on the mutation as well as the check
            // above, so a concurrent ownership change cannot reopen the hole.
            where: { id: postId, userId: session.user.id },
            data: {
                published: publish === "true" ? true : false,
            },
        });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    const postId = url.searchParams.get("postId");
    if (!postId) {
        return NextResponse.json(
            { error: "postId is required" },
            { status: 400 },
        );
    }

    try {
        const existing = await prisma.post.findUnique({
            where: { id: postId },
            select: { userId: true },
        });
        if (!existing) {
            return NextResponse.json(
                { error: "Post not found" },
                { status: 404 },
            );
        }
        if (existing.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.post.delete({
            // Defense in depth against a row changing between lookup and
            // deletion: the destructive query remains owner-scoped.
            where: { id: postId, userId: session.user.id },
        });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}
