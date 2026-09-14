import prisma from "@/db";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const session = await auth();
    try {
        const url = new URL(req.url);
        const cursor = url.searchParams.get("cursor");
        const getSeries = await prisma.postSeries.findMany({
            where: {
                authorId: session?.user.id,
            },
            take: 50,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            orderBy: {
                updatedAt: "desc",
            },
            select: {
                id: true,
                title: true,
                description: true,
                authorId: true,
                updatedAt: true,
                _count: { select: { posts: true } },
            },
        });
        return NextResponse.json(
            { data: getSeries, lastCursor: getSeries.at(-1)?.id ?? null },
            { status: 200 },
        );
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get("seriesId") as string;

    const body = await req.formData();
    const title = body.get("title") as string;
    const description = body.get("description") as string;
    try {
        const postSeries = await prisma.postSeries.update({
            where: {
                authorId: session?.user.id,
                id: seriesId,
            },
            data: {
                title,
                description,
            },
        });
        if (postSeries) return NextResponse.json({ status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    const body = await req.formData();
    const title = body.get("title") as string;
    const description = body.get("description") as string;

    try {
        const postSeries = await prisma.postSeries.create({
            data: {
                title: title,
                description: (description as string) || "",
                author: {
                    connect: {
                        id: session?.user.id,
                    },
                },
            },
        });
        if (postSeries) return NextResponse.json({ status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 200 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get("seriesId");

    try {
        const deleteSeries = await prisma.postSeries.delete({
            where: {
                authorId: session?.user.id,
                id: seriesId as string,
            },
        });
        if (deleteSeries) return NextResponse.json({ status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}
