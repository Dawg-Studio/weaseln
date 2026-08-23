import type { MetadataRoute } from "next";

const SITE_URL = (
    process.env.BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/manage/", "/settings/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
