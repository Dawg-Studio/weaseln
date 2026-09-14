import prisma from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const titleId = url.searchParams.get("titleId")

    const getPostComments = await prisma.postComment.findMany({
        include: {
            postCommentReplies: true,
            _count: { select: { reactions: true } },
        },
        where: { post: { titleId: titleId as string } },
        orderBy: {
            createdAt: 'desc'
        }
    })
    return NextResponse.json({ data: getPostComments }, { status: 200 })
}