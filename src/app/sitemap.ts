import type { MetadataRoute } from "next";
import prisma from "@/db";

const SITE_URL = (
    process.env.BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
).replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const posts = await prisma.post.findMany({
        where: { published: true },
        select: {
            titleId: true,
            authorUsername: true,
            userId: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
    });

    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: `${SITE_URL}/`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${SITE_URL}/about`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${SITE_URL}/coc`,
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/privacy`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/terms`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
    ];

    const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
        url: `${SITE_URL}/${p.authorUsername || p.userId}/${p.titleId}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
    }));

    return [...staticEntries, ...postEntries];
}
