"use server";

import { auth } from "@/auth";
import prisma from "@/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TagRank } from "@/types/tag";

// ponytail: previous implementation read `tagsRanking` (a cron-populated
// snapshot table). The table is empty on a fresh seed, so trending tags
// rendered as an empty list. Now we compute from posts/users directly:
// usage = posts that include the tag, followers = users with the tag in
// their interests. Returns the top 10 by usage. The cached `tagsRanking`
// snapshot is still populated by the cron if you want cheaper reads; this
// path is the source of truth.
export async function getTagRankings(): Promise<TagRank[]> {
    const posts = await prisma.post.findMany({
        select: { tags: true },
    });
    const usageByTag = new Map<string, number>();
    for (const post of posts) {
        for (const tag of post.tags) {
            usageByTag.set(tag, (usageByTag.get(tag) ?? 0) + 1);
        }
    }

    const ranks: TagRank[] = [];
    for (const [tag, usage] of usageByTag.entries()) {
        const followers = await prisma.user.count({
            where: { interests: { has: tag } },
        });
        ranks.push({ tag, usage, followers });
    }

    ranks.sort((a, b) => b.usage - a.usage);
    return ranks.slice(0, 10);
}

export async function updateInterest(tag: string) {
    const session = await auth();
    try {
        const getUser = await prisma.user.findUnique({
            where: {
                id: session?.user.id,
            },
        });
        //if user hasn't followed the tag
        const ifNotFollowing = getUser?.interests.filter(
            (interest: string) => interest === tag,
        );
        if (ifNotFollowing?.length === 0) {
            const updateUser = await prisma.user.update({
                where: {
                    id: session?.user.id,
                },
                data: {
                    interests: {
                        push: tag,
                    },
                },
            });
            if (updateUser) return "following";
        }
        // unfollow tag
        const newInterests = [
            ...(getUser?.interests as string[]).filter(
                (interest) => interest !== tag,
            ),
        ];
        const updateUser = await prisma.user.update({
            where: {
                id: session?.user.id,
            },
            data: {
                interests: newInterests,
            },
        });
        if (updateUser) return "unfollowing";
    } catch (err) {
        console.log(err);
        return err;
    }
}

export async function ifTagFollowing(tag: string) {
    const session = await auth();
    const tagFollowed = await prisma.user.findUnique({
        where: {
            id: session?.user.id,
            interests: {
                has: tag,
            },
        },
    });
    if (tagFollowed) return true;
    return false;
}

export async function validateTag(tag: string) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `You are a helpful assistant and I want you to validate the following keyword for tag creation. Follow the rules: 1. A tag must not contain any malicious word in any languages. 2. You will only output true or false. Now validate the tag: ${tag}`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log(text);
    if (text?.toLowerCase().includes("true")) return true;
    return false;
}
