import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

import prisma from "@/db";
import {
    deletePost,
    listPosts,
    setPostPublished,
    type PostSort,
} from "@/modules/posts/service";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const sort = url.searchParams.get("sort") as PostSort | null;

    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const cursor = url.searchParams.get("cursor");
        const posts = await listPosts(
            { userId: session.user.id },
            {
                ...(sort && { sort }),
                ...(cursor && { cursor }),
            },
        );
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

        await setPostPublished(
            { userId: session.user.id },
            { postId, published: publish === "true" ? true : false },
        );
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

        await deletePost({ userId: session.user.id }, { postId });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}
