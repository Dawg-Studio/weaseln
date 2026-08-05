import prisma from "@/db"
import { NextRequest, NextResponse } from "next/server"
import { computeTagRankings } from "@/utils/services/ranking"

export async function GET(req: NextRequest) {

    // ponytail: previous version returned `{ status: 401 }` in the JSON
    // body but left the HTTP status as 200, so unauthorized callers got a
    // 200 anyway. Pass the status into NextResponse so the route actually
    // rejects them.
    if (!process.env.CRON_SECRET) {
        return NextResponse.json(
            { error: "CRON_SECRET is not configured" },
            { status: 500 },
        )
    }
    if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // computeTagRankings (in src/utils/services/ranking.ts) holds the
        // pre-refactor `tagRanks()` body verbatim: iterate every unique tag in
        // posts.tags, count usages and followers, return TagRank[]. The cron
        // route just persists the result to the TagsRanking table.
        const result = await computeTagRankings();
        const createTagRank = await prisma.tagsRanking.create({
            data: {
                data: result,
            }
        });
        return NextResponse.json(
            {
                status: 200,
                rowsInserted: 1,
                tagsRanked: result.length,
                topTags: result.slice(0, 5).map(t => ({ tag: t.tag, usage: t.usage, followers: t.followers })),
            },
            { status: 200 },
        );
    } catch (err) {
        return NextResponse.json({ err: String(err) }, { status: 500 });
    }
}
