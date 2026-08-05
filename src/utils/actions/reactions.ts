"use server"

import { auth } from "@/auth"
import prisma from "@/db"
import { ReactionType } from "@/types/reaction"

type ReactionTarget = "post" | "comment"
type ReactionKey = { postId: string } | { commentId: string }

// ponytail: the post and comment reaction tables share the same access pattern; the only
// difference is the Prisma model and the key shape. Branch once, expose 3 generic helpers,
// keep the named exports as 1-line delegations so non-button callers (notifications, other
// server actions) keep working unchanged.

export async function getReaction(target: ReactionTarget, key: ReactionKey) {
    const session = await auth()
    if (!session) throw new Error("Unauthorized")

    if (target === "post" && "postId" in key) {
        const reaction = await prisma.postReaction.findUnique({
            where: {
                postId_userId: {
                    postId: key.postId,
                    userId: session.user.id,
                },
            },
        })
        return reaction ? reaction.type : false
    }
    if (target === "comment" && "commentId" in key) {
        const reaction = await prisma.commentReaction.findUnique({
            where: {
                commentId_userId: {
                    commentId: key.commentId,
                    userId: session.user.id,
                },
            },
        })
        return reaction ? reaction.type : false
    }
    throw new Error(`Invalid key shape for target "${target}"`)
}

export async function toggleReaction(
    target: ReactionTarget,
    key: ReactionKey,
    type: ReactionType,
) {
    const session = await auth()
    if (!session) throw new Error("Unauthorized")

    try {
        if (target === "post" && "postId" in key) {
            const upserted = await prisma.postReaction.upsert({
                where: {
                    postId_userId: {
                        userId: session.user.id,
                        postId: key.postId,
                    },
                },
                update: { type },
                create: {
                    type,
                    post: { connect: { id: key.postId } },
                    user: { connect: { id: session.user.id } },
                },
            })
            if (upserted) return true
        } else if (target === "comment" && "commentId" in key) {
            const upserted = await prisma.commentReaction.upsert({
                where: {
                    commentId_userId: {
                        userId: session.user.id,
                        commentId: key.commentId,
                    },
                },
                update: { type },
                create: {
                    type,
                    comment: { connect: { id: key.commentId } },
                    user: { connect: { id: session.user.id } },
                },
            })
            if (upserted) return true
        } else {
            throw new Error(`Invalid key shape for target "${target}"`)
        }
    } catch (error) {
        return error
    }
}

export async function deleteReaction(target: ReactionTarget, key: ReactionKey) {
    const session = await auth()
    if (!session) throw new Error("Unauthorized")

    try {
        if (target === "post" && "postId" in key) {
            const deleted = await prisma.postReaction.delete({
                where: {
                    postId_userId: {
                        postId: key.postId,
                        userId: session.user.id,
                    },
                },
            })
            if (deleted) return true
        } else if (target === "comment" && "commentId" in key) {
            const deleted = await prisma.commentReaction.delete({
                where: {
                    commentId_userId: {
                        commentId: key.commentId,
                        userId: session.user.id,
                    },
                },
            })
            if (deleted) return true
        } else {
            throw new Error(`Invalid key shape for target "${target}"`)
        }
    } catch (error) {
        return error
    }
}

export const getUserInitialPostReaction = (postId: string) =>
    getReaction("post", { postId })
export const getInitialCommentReaction = (commentId: string) =>
    getReaction("comment", { commentId })
export const updateCreatePostReaction = (postId: string, type: ReactionType) =>
    toggleReaction("post", { postId }, type)
export const updateCreateCommentReaction = (commentId: string, type: ReactionType) =>
    toggleReaction("comment", { commentId }, type)
export const deletePostReaction = (postId: string) =>
    deleteReaction("post", { postId })
export const deleteCommentReaction = (commentId: string) =>
    deleteReaction("comment", { commentId })
