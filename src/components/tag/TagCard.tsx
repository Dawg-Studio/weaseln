"use client";

import { TagRank } from "@/types/tag";
import Link from "next/link";
import TagFollowButton from "./actions/TagFollowButton";

export default function TagCard({
    tag,
    usage,
    followers,
    isLoggedIn,
}: TagRank & { isLoggedIn: boolean }) {
    return (
        <div className="group relative flex w-full min-w-0 basis-[19rem] flex-col rounded-box border border-hairline bg-surface elev-1 lift p-5 focus-within:border-primary/45">
            <div className="mb-5 break-words">
                <Link
                    href={`/tag/${tag}`}
                    className="-m-1 flex items-start gap-3 rounded-field p-1"
                >
                    <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-field bg-tint text-lg font-bold text-base-content transition-colors duration-200 ease-burrow group-hover:bg-tint-strong"
                    >
                        #
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-eyebrow uppercase text-muted">
                            Topic
                        </div>
                        <h2 className="line-clamp-2 break-words text-headline text-base-content transition-colors duration-150 group-hover:text-primary">
                            #{tag}
                        </h2>
                    </div>
                </Link>
            </div>
            <div className="mt-auto flex items-center justify-between gap-4 hairline-t pt-4">
                <div className="flex min-w-0 items-center gap-5">
                    <p className="flex flex-col gap-0.5">
                        <span className="nums text-base font-semibold leading-none text-base-content">
                            {usage}
                        </span>
                        <span className="text-eyebrow uppercase text-muted">
                            Posts
                        </span>
                    </p>
                    <span
                        aria-hidden="true"
                        className="h-8 w-px shrink-0 bg-hairline"
                    />
                    <p className="flex flex-col gap-0.5">
                        <span className="nums text-base font-semibold leading-none text-base-content">
                            {followers}
                        </span>
                        <span className="text-eyebrow uppercase text-muted">
                            Followers
                        </span>
                    </p>
                </div>
                <TagFollowButton tag={tag} isLoggedIn={isLoggedIn} />
            </div>
        </div>
    );
}
