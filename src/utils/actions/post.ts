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

export async function addOrUpdateUserPostReadingHistory(postId: string, readingLengthMs: number) {
    const session = await auth()

    async function addPostReadingLength() {
        const newPostReadingLength = await prisma.postReadingLength.create({
            data: {
                postId: postId,
                readingLength: readingLengthMs
            }
        })
        if (newPostReadingLength) return true
    }

    if (!session) {
        await addPostReadingLength()
    } else {
        //find if a reading history already existed
        const getPastReadingHistory = await prisma.postReadingHistory.findUnique({
            where: {
                userId_postId: {
                    userId: session?.user.id,
                    postId: postId
                }
            }
        })
        //if a reading history didn't exist, create a new one
        if (!getPastReadingHistory) {
            //create a reading length first
            const newPostReadingLength = await prisma.postReadingLength.create({
                data: {
                    postId: postId,
                    readingLength: readingLengthMs
                }
            })
            if (newPostReadingLength) {
                //and connect it for the reading history
                const newPostReadingHistory = await prisma.postReadingHistory.create({
                    data: {
                        userId: session?.user.id,
                        postId: postId,
                        readingLengthId: newPostReadingLength.id
                    }
                })
                if (newPostReadingHistory) return true
            }
        } else {
            //increment the reading length
            const updatePostReadingLength = await prisma.postReadingLength.update({
                where: { id: getPastReadingHistory.readingLengthId },
                data: {
                    readingLength: {
                        increment: readingLengthMs
                    }
                }
            })
            if (updatePostReadingLength) return true
        }
    }

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
