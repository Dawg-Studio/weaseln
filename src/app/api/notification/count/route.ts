import prisma from "@/db";

import { auth } from "@/auth";

export async function GET() {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    const count = await prisma.userNotifications.count({
        where: {
            userId: session.user.id,
            OR: [
                { fromUserId: { not: session.user.id } },
                { fromUserId: null },
            ],
            new: true,
        },
    });
    return Response.json({ count });
}
