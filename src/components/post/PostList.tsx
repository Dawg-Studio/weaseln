"use client";

import { Post } from "@prisma/client";
import { CSSProperties, Fragment, useEffect, useState } from "react";
import {
    faMagnifyingGlass,
    faNewspaper,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PostContainer from "./PostContainer";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import PostContainerLoader from "./PostContainerLoader";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { cn } from "@/utils/cn";

type PostListItem = Post & {
    _count?: { reactions: number; comments: number };
    organization: {
        id: string;
        name: string;
        image: string;
        username: string;
    } | null;
};

// Segmented-control segment. Rest is a quiet muted label on the sunken track;
// the selected one is lifted onto a `surface` pill and marked with the 2px
// rust rail the design system uses for every active/selected state.
const feedTab = (isActive: boolean) =>
    cn(
        "relative rounded-field border border-transparent px-3.5 py-1.5 text-sm font-semibold press",
        isActive
            ? "border-hairline bg-surface text-base-content elev-1"
            : "text-muted hover:bg-base-300 hover:text-base-content",
    );

const feedRail = (isActive: boolean) =>
    cn(
        "absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary transition-opacity duration-200",
        isActive ? "opacity-100" : "opacity-0",
    );

export default function PostList({
    keyword,
    tag,
    userId,
    published,
    orgId,
    postId,
    isHideCurrentPost = false,
    isHideFeedOpts = false,
}: {
    keyword?: string;
    tag?: string;
    userId?: string;
    orgId?: string;
    postId?: string;
    published?: boolean;
    isHideCurrentPost?: boolean;
    isHideFeedOpts?: boolean;
}) {
    const pathName = usePathname();
    const searchParams = useSearchParams();
    const [feed, setFeed] = useState<"relevance" | "latest" | "most-popular">(
        () =>
            (searchParams.get("feed") as
                | "relevance"
                | "latest"
                | "most-popular") ?? "relevance",
    );
    const { replace } = useRouter();

    const { items, ref, isLoading, hasNextPage } = useInfiniteList<PostListItem>(
        {
            queryKey: (
                [
                    "posts",
                    feed,
                    keyword,
                    tag,
                    userId,
                    orgId,
                    postId,
                    published,
                ].filter(Boolean) as string[]
            ),
            fetcher: async (cursor) => {
                const params = new URLSearchParams({
                    q: keyword ?? "",
                    tag: tag ?? "",
                    userId: userId ?? "",
                    orgId: orgId ?? "",
                    postId: postId ?? "",
                    isHideCurrentPost: isHideCurrentPost.toString(),
                    orderBy: feed ?? "relevance",
                    published: published ? published.toString() : "true",
                    cursor: cursor ?? "",
                });
                const response = await fetch(`/api/post?${params}`);
                const json = await response.json();
                return {
                    items: json.data?.data ?? [],
                    nextCursor: json.data?.metaData?.lastCursor ?? undefined,
                };
            },
        },
    );

    // ponytail: searchParams is intentionally NOT in the dep list. replace() mutates
    // the URL's searchParams, which would re-fire this effect and loop forever.
    useEffect(() => {
        replace(
            `${pathName}?${keyword ? `q=${keyword}&` : ""}feed=${
                feed ?? "relevance"
            }`,
            { scroll: false },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feed, keyword, pathName]);

    return (
        <>
            {items.length > 0 && !isHideFeedOpts && (
                <div
                    className={cn(
                        "mb-6 flex items-center",
                        keyword ? "justify-end" : "justify-start",
                    )}
                >
                    <div
                        role="group"
                        aria-label="Sort the feed"
                        className="inline-flex items-center gap-1 rounded-box border border-hairline bg-base-200 p-1"
                    >
                        <button
                            type="button"
                            aria-pressed={feed === "relevance"}
                            className={feedTab(feed === "relevance")}
                            onClick={() => setFeed("relevance")}
                        >
                            Relevant
                            <span
                                aria-hidden="true"
                                className={feedRail(feed === "relevance")}
                            />
                        </button>
                        <button
                            type="button"
                            aria-pressed={feed === "latest"}
                            className={feedTab(feed === "latest")}
                            onClick={() => setFeed("latest")}
                        >
                            Latest
                            <span
                                aria-hidden="true"
                                className={feedRail(feed === "latest")}
                            />
                        </button>
                        <button
                            type="button"
                            aria-pressed={feed === "most-popular"}
                            className={feedTab(feed === "most-popular")}
                            onClick={() => setFeed("most-popular")}
                        >
                            Most Popular
                            <span
                                aria-hidden="true"
                                className={feedRail(feed === "most-popular")}
                            />
                        </button>
                    </div>
                </div>
            )}
            <div className="space-y-4">
                {!isLoading && items.length > 0 ? (
                    items.map((post, index) => {
                        // Stagger the arrival of the first few cards only —
                        // capped so infinitely-appended pages never sit behind
                        // a multi-second delay. Neutralised entirely under
                        // prefers-reduced-motion (see globals.css).
                        const enterDelay = {
                            "--enter-delay": `${Math.min(index, 5) * 45}ms`,
                        } as CSSProperties;
                        return (
                            <Fragment key={post.id}>
                                {items.length === index + 1 ? (
                                    <div
                                        ref={ref}
                                        className="enter"
                                        style={enterDelay}
                                    >
                                        <PostContainer {...post} />
                                    </div>
                                ) : (
                                    <div className="enter" style={enterDelay}>
                                        <PostContainer {...post} />
                                    </div>
                                )}
                            </Fragment>
                        );
                    })
                ) : (
                    // ponytail: the loader is gated on `isLoading` (mirrors
                    // PeopleList). Without the guard a settled, empty result
                    // set renders three shimmering placeholder cards on top of
                    // the empty state below.
                    isLoading && <PostContainerLoader />
                )}
                {items.length === 0 && !isLoading && (
                    <div className="brand-wash flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                        <FontAwesomeIcon
                            icon={keyword ? faMagnifyingGlass : faNewspaper}
                            className="text-3xl text-primary/55"
                        />
                        <h3 className="text-base font-semibold text-base-content">
                            {keyword
                                ? "No results were found."
                                : "Nothing here yet."}
                        </h3>
                        <p className="measure text-sm text-muted">
                            {keyword
                                ? "Nothing matched that search. Try a shorter keyword or a different tag."
                                : "There are no posts to show on this feed just yet. Check back soon."}
                        </p>
                    </div>
                )}
                {items.length > 0 && !hasNextPage && !isLoading && (
                    <div className="mx-auto flex max-w-md items-center gap-3 pt-2">
                        <span
                            aria-hidden="true"
                            className="h-px flex-1 bg-hairline"
                        />
                        <span className="text-eyebrow uppercase text-muted">
                            End of Results
                        </span>
                        <span
                            aria-hidden="true"
                            className="h-px flex-1 bg-hairline"
                        />
                    </div>
                )}
            </div>
        </>
    );
}
