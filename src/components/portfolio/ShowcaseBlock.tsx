import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ItemInput, ShowcaseLayout } from "@/modules/portfolio/types";
import { normalizeShowcaseLayout } from "@/modules/portfolio/validation";

type ShowcaseItem = ItemInput & { id: string; slug: string };

type ShowcaseBlockProps = {
    showcase: {
        title: string;
        description: string | null;
        /** a stored column: normalize before it reaches the layout table */
        layout: string;
        slug: string;
    };
    items: ShowcaseItem[];
    userId: string;
    /** Where the heading links. Without it the heading stays plain text. */
    titleHref?: string;
};

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;

function itemHref(userId: string, showcaseSlug: string, itemSlug: string) {
    return `/${userId}/portfolio/${showcaseSlug}/${itemSlug}`;
}

function previewImage(item: ShowcaseItem): string | null {
    return item.coverImage ?? item.gallery[0] ?? null;
}

function PreviewMedia({ item, href }: { item: ShowcaseItem; href: string }) {
    const src = previewImage(item);
    if (!src) return null;
    return (
        <Link href={href} className="block overflow-hidden rounded-box">
            <Image
                src={src}
                alt={item.title}
                width={IMAGE_WIDTH}
                height={IMAGE_HEIGHT}
                loading="lazy"
                className="h-48 w-full object-cover transition-transform hover:scale-[1.02]"
            />
        </Link>
    );
}

function Tags({ tags }: { tags: string[] }) {
    if (tags.length === 0) return null;
    return (
        <ul className="flex flex-wrap gap-1">
            {tags.map((tag) => (
                <li key={tag} className="badge badge-soft badge-sm">
                    {tag}
                </li>
            ))}
        </ul>
    );
}

function ExternalLink({ link, title }: { link: string | null; title: string }) {
    if (!link || !/^https?:\/\//.test(link)) return null;
    return (
        <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            className="link link-primary text-sm"
        >
            {title} — visit
        </a>
    );
}

function ItemHeading({ item, href }: { item: ShowcaseItem; href: string }) {
    return (
        <Link href={href} className="link-hover font-semibold">
            {item.title}
        </Link>
    );
}

function GridLayout({ items, userId, showcaseSlug }: LayoutProps) {
    return (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
                const href = itemHref(userId, showcaseSlug, item.slug);
                return (
                    <li key={item.id} className="rounded-box border border-hairline bg-surface p-4 elev-1">
                        <PreviewMedia item={item} href={href} />
                        <div className="mt-3 space-y-1">
                            <ItemHeading item={item} href={href} />
                            {item.summary && <p className="text-sm">{item.summary}</p>}
                            <Tags tags={item.tags} />
                            <ExternalLink link={item.link} title={item.title} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function GalleryLayout({ items, userId, showcaseSlug }: LayoutProps) {
    return (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
                const href = itemHref(userId, showcaseSlug, item.slug);
                const images = item.gallery.length > 0 ? item.gallery : (previewImage(item) ? [previewImage(item)] : []);
                return (
                    <li key={item.id} className="space-y-2">
                        {images.map((src) => (
                            <Link key={src} href={href} className="block overflow-hidden rounded-box">
                                <Image
                                    src={src as string}
                                    alt={item.title}
                                    width={IMAGE_WIDTH}
                                    height={IMAGE_HEIGHT}
                                    loading="lazy"
                                    className="h-48 w-full object-cover"
                                />
                            </Link>
                        ))}
                        <ItemHeading item={item} href={href} />
                    </li>
                );
            })}
        </ul>
    );
}

function ListLayout({ items, userId, showcaseSlug }: LayoutProps) {
    return (
        <ul className="divide-y divide-hairline">
            {items.map((item) => {
                const href = itemHref(userId, showcaseSlug, item.slug);
                return (
                    <li key={item.id} className="flex flex-wrap items-baseline gap-2 py-3">
                        <ItemHeading item={item} href={href} />
                        {item.date && <span className="text-xs opacity-70">{item.date}</span>}
                        {item.summary && <p className="w-full text-sm">{item.summary}</p>}
                        <Tags tags={item.tags} />
                        <ExternalLink link={item.link} title={item.title} />
                    </li>
                );
            })}
        </ul>
    );
}

function byDateDescending(a: ShowcaseItem, b: ShowcaseItem) {
    if (a.date === b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
}

function TimelineLayout({ items, userId, showcaseSlug }: LayoutProps) {
    const ordered = [...items].sort(byDateDescending);
    return (
        <ol className="border-l border-hairline pl-4">
            {ordered.map((item) => {
                const href = itemHref(userId, showcaseSlug, item.slug);
                return (
                    <li key={item.id} className="relative py-3">
                        <span
                            aria-hidden="true"
                            className="absolute -left-[21px] top-5 h-2 w-2 rounded-full bg-primary"
                        />
                        <div className="flex flex-wrap items-baseline gap-2">
                            <ItemHeading item={item} href={href} />
                            {item.date && <span className="text-xs opacity-70">{item.date}</span>}
                        </div>
                        {item.summary && <p className="text-sm">{item.summary}</p>}
                    </li>
                );
            })}
        </ol>
    );
}

type LayoutProps = {
    items: ShowcaseItem[];
    userId: string;
    showcaseSlug: string;
};

const LAYOUTS: Record<ShowcaseLayout, (_props: LayoutProps) => ReactNode> = {
    grid: GridLayout,
    gallery: GalleryLayout,
    list: ListLayout,
    timeline: TimelineLayout,
};

/**
 * One block per showcase. An empty showcase renders nothing at all, so a
 * profile only grows when its owner put something in it.
 */
export default function ShowcaseBlock({ showcase, items, userId, titleHref }: ShowcaseBlockProps) {
    if (items.length === 0) return null;

    const Layout = LAYOUTS[normalizeShowcaseLayout(showcase.layout)];

    return (
        <section className="mb-6 space-y-3" data-testid={`showcase-${showcase.slug}`}>
            <div>
                <h2 className="text-2xl font-bold">
                    {titleHref ? (
                        <Link href={titleHref} className="link-hover">
                            {showcase.title}
                        </Link>
                    ) : (
                        showcase.title
                    )}
                </h2>
                {showcase.description && <p className="text-sm opacity-80">{showcase.description}</p>}
            </div>
            <Layout items={items} userId={userId} showcaseSlug={showcase.slug} />
        </section>
    );
}
