import prisma from "@/db";

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();
    const getNotifications = await prisma.userNotifications.count({
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
            new: true,
        },
    });
    return NextResponse.json({ data: getNotifications }, { status: 200 });
}
