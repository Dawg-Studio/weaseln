"use server";

import { auth } from "@/auth";
import prisma from "@/db";
import { GoogleGenAI } from "@google/genai";
import { getTagUsageAndFollowers } from "@/utils/services/ranking";
import type { TagRank } from "@/types/tag";

// ponytail: previous implementation read `tagsRanking` (a cron-populated
// snapshot table). The table is empty on a fresh seed, so trending tags
// rendered as an empty list. Now we compute from posts/users directly:
// usage = posts that include the tag, followers = users with the tag in
// their interests. Returns the top 10 by usage. The cached `tagsRanking`
// snapshot is still populated by the cron if you want cheaper reads; this
// path is the source of truth.
export async function getTagRankings(): Promise<TagRank[]> {
    const ranks = await getTagUsageAndFollowers();
    ranks.sort((a, b) => b.usage - a.usage);
    return ranks.slice(0, 10);
}

export async function updateInterest(tag: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    const appended = await prisma.$executeRaw`
        UPDATE users."User"
        SET interests = array_append(interests, ${tag})
        WHERE id = ${session.user.id} AND NOT (${tag} = ANY(interests))`;
    if (appended === 0) {
        await prisma.$executeRaw`
            UPDATE users."User"
            SET interests = array_remove(interests, ${tag})
            WHERE id = ${session.user.id}`;
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
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_AI_KEY as string,
    });
    const prompt = `You are a helpful assistant and I want you to validate the following keyword for tag creation. Follow the rules: 1. A tag must not contain any malicious word in any languages. 2. You will only output true or false. Now validate the tag: ${tag}`;
    const interaction = await ai.interactions.create({
        model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
        input: prompt,
    });
    const text = interaction.output_text ?? "";
    console.log(text);
    if (text.toLowerCase().includes("true")) return true;
    return false;
}
