"use client";

import { Post } from "@prisma/client";
import { Fragment, useEffect, useState } from "react";
import PostContainer from "./PostContainer";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import PostContainerLoader from "./PostContainerLoader";
import { useInfiniteList } from "@/hooks/useInfiniteList";

type PostListItem = Post & {
    _count?: { reactions: number; comments: number };
    organization: {
        id: string;
        name: string;
        image: string;
        username: string;
    } | null;
};

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
                    className={`flex items-center mb-6 ${
                        keyword ? "justify-end" : "justify-start"
                    } space-x-4`}
                >
                    <h3
                        className={`text-xl cursor-pointer hover:underline ${
                            feed === "relevance" ? "underline" : ""
                        }`}
                        onClick={() => setFeed("relevance")}
                    >
                        Relevant
                    </h3>
                    <h3
                        className={`text-xl cursor-pointer hover:underline ${
                            feed === "latest" ? "underline" : ""
                        }`}
                        onClick={() => setFeed("latest")}
                    >
                        Latest
                    </h3>
                    <h3
                        className={`text-xl cursor-pointer hover:underline ${
                            feed === "most-popular" ? "underline" : ""
                        }`}
                        onClick={() => setFeed("most-popular")}
                    >
                        Most Popular
                    </h3>
                </div>
            )}
            <div className="space-y-4">
                {!isLoading && items.length > 0 ? (
                    items.map((post, index) => (
                        <Fragment key={post.id}>
                            {items.length === index + 1 ? (
                                <div ref={ref}>
                                    <PostContainer {...post} />
                                </div>
                            ) : (
                                <div>
                                    <PostContainer {...post} />
                                </div>
                            )}
                        </Fragment>
                    ))
                ) : (
                    <PostContainerLoader />
                )}
                {keyword && items.length === 0 && !isLoading && (
                    <h3 className="text-xl">No results were found.</h3>
                )}
                {items.length > 0 && !hasNextPage && !isLoading && (
                    <div className=" divider divider-vertical text-sm max-w-md mx-auto">
                        End of Results
                    </div>
                )}
            </div>
        </>
    );
}
