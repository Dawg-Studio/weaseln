import prisma from "@/db";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const action = url.searchParams.get("action") as "add" | "remove";
    const seriesId = url.searchParams.get("seriesId") as string;
    const seriesTitle = url.searchParams.get("seriesTitle") as string;

    const where: Prisma.PostWhereInput = {
        userId: session.user.id,
        NOT: {
            series: {
                some: {
                    id: seriesId,
                    title: seriesTitle,
                },
            },
        },
    };

    if (action === "remove") {
        where.series = {
            some: {
                id: seriesId,
                title: seriesTitle,
            },
        };
    }

    try {
        const cursor = url.searchParams.get("cursor");
        const findArgs: Prisma.PostFindManyArgs = {
            where,
            take: 50,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            orderBy: {
                createdAt: "desc",
            },
            // ponytail: userId beyond brief's 4 fields so the consumer's `/${authorUsername || userId}/${titleId}` link has a fallback when authorUsername is null
            select: {
                id: true,
                title: true,
                titleId: true,
                published: true,
                userId: true,
            },
        };
        const getPosts = await prisma.post.findMany(findArgs);
        if (getPosts)
            return NextResponse.json(
                { data: getPosts, lastCursor: getPosts.at(-1)?.id ?? null },
                { status: 200 },
            );
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const seriesId = url.searchParams.get("seriesId") as string;
    const postId = url.searchParams.get("postId") as string;

    try {
        const addPostToSeries = await prisma.postSeries.update({
            where: {
                id: seriesId,
                authorId: session.user.id,
            },
            data: {
                posts: {
                    connect: {
                        id: postId,
                    },
                },
            },
        });
        if (addPostToSeries) return NextResponse.json({ status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const seriesId = url.searchParams.get("seriesId") as string;
    const postId = url.searchParams.get("postId") as string;

    try {
        const disconnectPostToSeries = await prisma.postSeries.update({
            where: {
                authorId: session.user.id,
                id: seriesId,
            },
            data: {
                posts: {
                    disconnect: {
                        id: postId,
                    },
                },
            },
        });
        if (disconnectPostToSeries) return NextResponse.json({ status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}
