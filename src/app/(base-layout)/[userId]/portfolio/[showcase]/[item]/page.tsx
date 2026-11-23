import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/html";
import parse from "html-react-parser";

import tiptapExtensions from "@/utils/tiptapExt";
import { markdownToTiptap } from "@/modules/post-content/markdown";
import { getProfile } from "@/utils/server/loaders";

type Params = {
    params: Promise<{ userId: string; showcase: string; item: string }>;
};

async function loadItem(userId: string, showcaseSlug: string, itemSlug: string) {
    const user = await getProfile(userId);
    if (!user) return null;
    const showcase = user.showcases.find((entry) => entry.slug === showcaseSlug);
    if (!showcase) return null;
    const item = showcase.items.find((entry) => entry.slug === itemSlug);
    if (!item) return null;
    return { user, showcase, item };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { userId, showcase: showcaseSlug, item: itemSlug } = await params;
    const found = await loadItem(userId, showcaseSlug, itemSlug);
    if (!found) return { title: "Item not found" };

    return {
        title: `${found.item.title} — ${found.user.name ?? found.user.username}`,
        description: found.item.summary ?? undefined,
        openGraph: {
            images: [found.item.coverImage ?? found.item.gallery[0] ?? ""].filter(
                Boolean,
            ),
        },
    };
}

export default async function PortfolioItemPage({ params }: Params) {
    const { userId, showcase: showcaseSlug, item: itemSlug } = await params;
    const found = await loadItem(userId, showcaseSlug, itemSlug);
    if (!found) notFound();

    const { showcase, item } = found;
    const description = item.description
        ? generateHTML(
              markdownToTiptap(item.description) as JSONContent,
              tiptapExtensions(),
          )
        : "";
    const externalLink = /^https?:\/\//.test(item.link ?? "") ? item.link : null;

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
            <nav className="mb-4 text-sm">
                <Link
                    href={`/${userId}/portfolio/${showcase.slug}`}
                    className="link link-hover"
                >
                    {showcase.title}
                </Link>
            </nav>

            <h1 className="text-3xl font-bold">{item.title}</h1>
            <div className="mt-1 flex flex-wrap items-baseline gap-3 text-sm opacity-70">
                <span className="nums">{item.date}</span>
                {item.tags.map((tag) => (
                    <span key={tag} className="badge badge-soft badge-sm">
                        {tag}
                    </span>
                ))}
            </div>

            {item.coverImage && (
                <figure className="mt-6 overflow-hidden rounded-box">
                    <Image
                        src={item.coverImage}
                        alt={item.title}
                        width={1200}
                        height={800}
                        className="w-full object-cover"
                        priority
                    />
                </figure>
            )}

            {description && (
                <div className="prose mt-6 max-w-none">{parse(description)}</div>
            )}

            {item.gallery.length > 0 && (
                <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                    {item.gallery.map((src) => (
                        <li key={src} className="overflow-hidden rounded-box">
                            <Image
                                src={src}
                                alt={item.title}
                                width={1200}
                                height={800}
                                loading="lazy"
                                className="h-full w-full object-cover"
                            />
                        </li>
                    ))}
                </ul>
            )}

            {externalLink && (
                <p className="mt-8">
                    <a
                        href={externalLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="link link-primary"
                    >
                        Visit the project
                    </a>
                </p>
            )}
        </main>
    );
}
