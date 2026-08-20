import prisma from "@/db";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const keyword = url && url.searchParams.get("q");
    const session = await auth();
    const getNotifications = await prisma.userNotifications.findMany({
        where: {
            userId: session?.user.id,
            OR: [
                {
                    fromUserId: {
                        not: session?.user.id,
                    },
                },
                {
                    fromUserId: null,
                },
            ],
            ...(keyword && {
                message: {
                    search: keyword,
                },
            }),
        },
        include: {
            post: {
                select: {
                    title: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return NextResponse.json({ data: getNotifications }, { status: 200 });
}
