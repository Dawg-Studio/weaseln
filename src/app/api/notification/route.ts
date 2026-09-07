import prisma from "@/db";

import { auth } from "@/auth";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const rows = await prisma.userNotifications.findMany({
        where: { userId: session.user.id },
        take: 50,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
        include: { fromUser: { select: { id: true, name: true, image: true } } },
    });
    return Response.json({ data: rows, lastCursor: rows.at(-1)?.id ?? null });
}
