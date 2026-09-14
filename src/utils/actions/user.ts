"use server"

import { auth } from "@/auth";
import prisma from "@/db";

export async function checkUserLoggedIn() {
    const session = await auth()
    if (session) return true
    return false
}

export async function toggleFollowUser(userId: string) {
    const session = await auth()
    return prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
            where: {
                id: session?.user.id,
                following: { some: { id: userId } },
            },
            select: { id: true },
        })
        if (existing) {
            await tx.user.update({
                where: { id: userId },
                data: { followedBy: { disconnect: { id: session?.user.id } } },
            })
            return "unfollowing"
        }
        await tx.user.update({
            where: { id: userId },
            data: { followedBy: { connect: { id: session?.user.id } } },
        })
        return "following"
    })
}
