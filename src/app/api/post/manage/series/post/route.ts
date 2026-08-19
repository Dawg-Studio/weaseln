import prisma from "@/db";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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
        const findArgs: Prisma.PostFindManyArgs = {
            where,
            orderBy: {
                createdAt: "desc",
            },
        };
        const getPosts = await prisma.post.findMany(findArgs);
        if (getPosts)
            return NextResponse.json({ data: getPosts }, { status: 200 });
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
