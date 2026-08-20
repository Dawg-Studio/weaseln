"use server";
import prisma from "@/db";

export async function isCommentOwner(userId: string, titleId: string) {
    const getPostId = await prisma.post.findUnique({
        where: {
            titleId: titleId,
            userId: userId
        },
        select: {
            id: true,
        }
    });
    const commentOwner = await prisma.postComment.findFirst({
        where: {
            userId: userId
        },
        select: {
            userId: true
        }

    });

    if (!commentOwner) {
        throw new Error("You have no comment for this post yet");
    }
    return {
        commentOwner: commentOwner.userId,
        postOwner: getPostId?.id
    };
}

export async function deleteComments(id: string) {
    const remove = await prisma.postComment.update({
        where: {
            id: id,
        },
        data: {
            isRemoved: true,
        },
        select: {
            isRemoved: true,
        },
    });
    return remove.isRemoved;
}
