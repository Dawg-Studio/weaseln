"use client";

import { TagRank } from "@/types/tag";
import { getTagRankings } from "@/utils/actions/tag";
import { faFire } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TagsRanking } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/utils/cn";

/* Ten rows at alternating widths, mirroring the real list's rhythm so nothing
   reflows on resolve. The panel used to collapse to an empty box on first
   paint, which read as a layout bug in the rail. */
const SKELETON_WIDTHS = [
    "w-full",
    "w-4/5",
    "w-3/5",
    "w-full",
    "w-4/5",
    "w-3/5",
    "w-full",
    "w-4/5",
    "w-3/5",
    "w-4/5",
];

export default function TagRankingMenu() {
    const [tagsRanking, setTagsRanking] = useState<
        TagsRanking[] | JsonValue[]
    >();

    useEffect(() => {
        getTagRankings().then((response) => setTagsRanking(response));
    }, []);

    const rankings = tagsRanking ? (tagsRanking as TagRank[]) : undefined;

    return (
        /* Card chrome is lg-only: below lg this module only renders inside the
           navbar drawer, stacked under SideMenu on a surface that already is a
           raised sheet. */
        <section
            aria-label="Trending tags"
            className="lg:rounded-box lg:border lg:border-hairline lg:bg-surface lg:elev-1 lg:p-5"
        >
            <div className="flex items-center gap-2 mb-4">
                <h3 className="brand-rule text-headline text-base-content">
                    Trending tags
                </h3>
                <FontAwesomeIcon
                    icon={faFire}
                    className="w-4 shrink-0 text-primary"
                />
            </div>
            {!rankings && (
                <>
                    <ul className="space-y-3" aria-hidden="true">
                        {SKELETON_WIDTHS.map((width, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-3"
                            >
                                <span className="shimmer h-4 w-5 shrink-0 rounded-field" />
                                <span
                                    className={cn(
                                        "shimmer h-4 rounded-field",
                                        width,
                                    )}
                                />
                            </li>
                        ))}
                    </ul>
                    <span className="sr-only">Loading trending tags</span>
                </>
            )}
            {rankings && rankings.length === 0 && (
                <div className="brand-wash flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-5 py-10 text-center">
                    <FontAwesomeIcon
                        icon={faFire}
                        className="text-3xl text-primary/55"
                    />
                    <p className="text-base font-semibold text-base-content">
                        No trending tags yet
                    </p>
                    <p className="measure text-sm text-muted">
                        Tags from newly published posts show up here.
                    </p>
                </div>
            )}
            {rankings && rankings.length > 0 && (
                <ul className="space-y-0.5">
                    {rankings.map((tag: TagRank, index) => (
                        <Fragment key={index}>
                            {index <= 9 && (
                                <li>
                                    <Link
                                        href={`/tag/${tag.tag}`}
                                        className="group -mx-2 flex items-center gap-3 rounded-field px-2 py-2 transition-colors duration-150 hover:bg-base-200"
                                    >
                                        {/* Ranks 1-3 carry the rust so the
                                            leaderboard has a top. */}
                                        <span
                                            className={cn(
                                                "w-5 shrink-0 text-right text-meta font-bold nums",
                                                index <= 2
                                                    ? "text-primary"
                                                    : "text-muted",
                                            )}
                                        >
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0 truncate text-sm font-semibold text-base-content/85 transition-colors duration-150 group-hover:text-primary">
                                            <span className="text-muted transition-colors duration-150 group-hover:text-primary">
                                                #
                                            </span>
                                            {tag.tag}
                                        </span>
                                    </Link>
                                </li>
                            )}
                        </Fragment>
                    ))}
                </ul>
            )}
        </section>
    );
}
