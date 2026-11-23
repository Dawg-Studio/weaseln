import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ShowcaseBlock from "@/components/portfolio/ShowcaseBlock";
import { getProfile } from "@/utils/server/loaders";

type Params = {
    params: Promise<{ userId: string; showcase: string }>;
};

async function loadShowcase(userId: string, slug: string) {
    const user = await getProfile(userId);
    if (!user) return null;
    const showcase = user.showcases.find((entry) => entry.slug === slug);
    if (!showcase) return null;
    return { user, showcase };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { userId, showcase: slug } = await params;
    const found = await loadShowcase(userId, slug);
    if (!found) return { title: "Showcase not found" };

    return {
        title: `${found.showcase.title} — ${found.user.name ?? found.user.username}`,
        description: found.showcase.description ?? undefined,
    };
}

export default async function ShowcasePage({ params }: Params) {
    const { userId, showcase: slug } = await params;
    const found = await loadShowcase(userId, slug);
    if (!found) notFound();

    return (
        <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <ShowcaseBlock
                showcase={found.showcase}
                items={found.showcase.items}
                userId={userId}
            />
        </div>
    );
}
