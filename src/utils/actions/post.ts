"use server"

import { auth } from "@/auth";
import prisma from "@/db";

export async function addPostView(postId: string) {
    const postView = await prisma.postView.create({
        data: {
            post: {
                connect: { id: postId }
            }
        }
    })
    return !!postView
}

export async function addOrUpdateUserPostReadingHistory(
    userId: string,
    postId: string,
    readingLengthMs: number,
) {
    await prisma.postReadingHistory.upsert({
        where: { userId_postId: { userId, postId } },
        update: {
            readingLength: {
                update: { readingLength: { increment: readingLengthMs } },
            },
        },
        create: {
            user: { connect: { id: userId } },
            post: { connect: { id: postId } },
            readingLength: { create: { postId, readingLength: readingLengthMs } },
        },
    });
    return true;
}

export async function checkBookmarkPostStatus(titleId: string) {
    const session = await auth()
    try {
        const checkBookmarkPost = await prisma.user.findUnique({
            where: {
                id: session?.user.id,
                bookMarks: {
                    some: {
                        titleId: titleId
                    }
                }
            },
        })
        if (checkBookmarkPost) return 'bookmarked'
        return 'unbookmarked'
    } catch (err) {
        return err
    }
}

export async function setBookmarkPost(titleId: string) {
    const session = await auth()
    return prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
            where: {
                id: session?.user.id,
                bookMarks: { some: { titleId } },
            },
            select: { id: true },
        })
        if (existing) {
            await tx.user.update({
                where: { id: session?.user.id },
                data: { bookMarks: { disconnect: { titleId } } },
            })
            return "unbookmarked"
        }
        await tx.user.update({
            where: { id: session?.user.id },
            data: { bookMarks: { connect: { titleId } } },
        })
        return "bookmarked"
    })
}
