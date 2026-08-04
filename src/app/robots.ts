import type { MetadataRoute } from "next";

const SITE_URL = process.env.BASE_URL ?? "https://www.zefer.blog";

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
