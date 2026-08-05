import prisma from "@/db"
import { NextRequest, NextResponse } from "next/server"
import { computeTagRankings } from "@/utils/services/ranking"

export async function GET(req: NextRequest) {

    if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ status: 401 })
    }

    try {
        // computeTagRankings (in src/utils/services/ranking.ts) holds the
        // pre-refactor `tagRanks()` body verbatim: iterate every unique tag in
        // posts.tags, count usages and followers, return TagRank[]. The cron
        // route just persists the result to the TagsRanking table.
        const createTagRank = await prisma.tagsRanking.create({
            data: {
                data: await computeTagRankings(),
            }
        })
        if (createTagRank) return NextResponse.json({ status: 200 })
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 })
    }
}
