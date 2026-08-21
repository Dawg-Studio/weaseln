"use client";

import { TagRank } from "@/types/tag";
import { Fragment, useEffect, useState } from "react";
import TagContainer from "./TagContainer";
import TagContainerLoader from "./TagContainerLoader";
import { faHashtag } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/utils/cn";

// Written out in full so Tailwind's scanner sees every class; the stagger caps
// at the last entry so a long result set never waits on a growing delay.
const ENTER_DELAYS = [
    "[--enter-delay:0ms]",
    "[--enter-delay:35ms]",
    "[--enter-delay:70ms]",
    "[--enter-delay:105ms]",
    "[--enter-delay:140ms]",
];

export default function TagList({ keyword }: { keyword?: string }) {
    const [tags, setTags] = useState<TagRank[]>();
    const [fetchingTags, setFetchingTags] = useState<boolean>(true);

    useEffect(() => {
        async function getTags() {
            setFetchingTags(true);
            const params = new URLSearchParams({
                q: keyword ?? "",
            });
            const response = await fetch(`/api/tag/ranking?${params}`);
            const data = await response.json();
            setTags(await data);
            setFetchingTags(false);
        }
        getTags();
    }, [keyword]);

    return (
        <>
            <div className="flex max-w-3xl flex-wrap gap-2.5">
                {tags?.length !== 0 &&
                    tags?.map((tag: TagRank, index: number) => (
                        <Fragment key={index}>
                            <span
                                className={cn(
                                    "enter inline-flex max-w-full",
                                    ENTER_DELAYS[
                                        Math.min(index, ENTER_DELAYS.length - 1)
                                    ],
                                )}
                            >
                                <TagContainer {...tag} />
                            </span>
                        </Fragment>
                    ))}
                {tags?.length === 0 && !fetchingTags && (
                    <div className="brand-wash enter flex w-full flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                        <FontAwesomeIcon
                            icon={faHashtag}
                            width={30}
                            className="text-3xl text-primary/55"
                            aria-hidden="true"
                        />
                        <h3 className="text-base font-semibold text-base-content">
                            No results were found.
                        </h3>
                        <p className="measure text-sm text-muted">
                            Nothing is tagged with that yet. Try a shorter or
                            more general keyword.
                        </p>
                    </div>
                )}
                {fetchingTags && <TagContainerLoader />}
            </div>
        </>
    );
}
