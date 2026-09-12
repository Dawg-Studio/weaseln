import { NextResponse } from "next/server";
import prisma from "@/db";

export async function GET() {
    const default_tags = [
        "travel",
        "food",
        "lifestyle",
        "fashion",
        "beauty",
        "health",
        "fitness",
        "technology",
        "business",
        "finance",
        "parenting",
        "education",
        "photography",
        "art",
        "books",
        "movies",
        "music",
        "crafts",
        "diy",
        "gardening",
        "home",
        "inspiration",
        "motivation",
        "personal",
        "productivity",
        "relationships",
        "self-improvement",
        "sustainability",
        "weddings",
        "celebrities",
        "culture",
        "humor",
        "sports",
    ];
    try {
        const distinct = await prisma.$queryRaw<{ tag: string }[]>`
            SELECT DISTINCT tag FROM posts."Post", unnest(tags) AS tag`;
        const tags = distinct.map((d) => d.tag).concat(default_tags ?? []);

        return NextResponse.json(Array.from(new Set(tags)).sort(), {
            status: 200,
        });
    } catch (err) {
        return NextResponse.json([err], { status: 500 });
    }
}
