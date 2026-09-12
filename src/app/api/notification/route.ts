import prisma from "@/db";

import { auth } from "@/auth";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const type = url.searchParams.get("type");
    const rows = await prisma.userNotifications.findMany({
        where: {
            userId: session.user.id,
            OR: [
                { fromUserId: { not: session.user.id } },
                { fromUserId: null },
            ],
            ...(type === "reactions" && { message: { contains: "reacted" } }),
            ...(type === "comments" && {
                OR: [
                    { message: { contains: "commented" } },
                    { message: { contains: "replied" } },
                ],
            }),
        },
        take: 50,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
        include: { post: { select: { title: true } } },
    });
    return Response.json({ data: rows, lastCursor: rows.at(-1)?.id ?? null });
}
