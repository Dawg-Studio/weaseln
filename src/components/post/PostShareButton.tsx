"use client";

import {
    faCheckCircle,
    faShareSquare,
} from "@fortawesome/free-solid-svg-icons";
import { faShareSquare as faRegShareSquare } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/utils/cn";

const subscribeToLocation = () => () => {};

// Inlined at build time when set; empty string when it is not configured.
const CONFIGURED_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(
    /\/+$/,
    "",
);

export function PostShareButton({
    userId,
    titleId,
    className,
}: {
    userId: string;
    titleId: string;
    // Optional sizing hook only — lets a caller match the control to the
    // height of the row it sits in. Purely additive; no behaviour change.
    className?: string;
}) {
    // ponytail: the share link must resolve to a real deployed origin. Prefer
    // the configured origin so it can never drift from `metadataBase`
    // (src/app/layout.tsx) or robots.ts/sitemap.ts again, and fall back to the
    // live origin so an unconfigured deployment still copies a working link
    // instead of a hardcoded one. NEXT_PUBLIC_* is inlined at build time, so
    // when it is set both snapshots agree — no hydration mismatch on the hrefs.
    const shareLink = useSyncExternalStore(
        subscribeToLocation,
        () =>
            new URL(
                `/${userId}/${titleId}`,
                CONFIGURED_ORIGIN || window.location.origin,
            ).toString(),
        () =>
            CONFIGURED_ORIGIN ? `${CONFIGURED_ORIGIN}/${userId}/${titleId}` : "",
    );
    const [linkCopyStatus, setLinkCopyStatus] = useState<boolean>(false);
    const [postShareActed, setPostShareActed] = useState<boolean>(false);
    return (
        <>
            <div className="dropdown dropdown-left lg:dropdown-right">
                <div
                    tabIndex={0}
                    role="button"
                    aria-label="Share this post"
                    className={cn(
                        "btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-field text-base-content/70 press",
                        "hover:bg-base-200 hover:text-base-content",
                        postShareActed && "text-primary hover:text-primary",
                        className,
                    )}
                >
                    <FontAwesomeIcon
                        icon={postShareActed ? faShareSquare : faRegShareSquare}
                        title="Share"
                        aria-hidden="true"
                        className="cursor-pointer"
                    />
                </div>
                <ul
                    tabIndex={0}
                    className="dropdown-content z-[1] menu mt-2 w-56 gap-0.5 rounded-box border border-hairline bg-surface p-2 elev-3"
                >
                    <li>
                        <div className="flex items-center gap-2">
                            <button
                                className="flex-1 text-left text-sm font-medium"
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    setLinkCopyStatus(true);
                                    setPostShareActed(true);
                                }}
                            >
                                {linkCopyStatus ? "Copied" : "Copy Link"}
                            </button>

                            {linkCopyStatus && (
                                <FontAwesomeIcon
                                    icon={faCheckCircle}
                                    aria-hidden="true"
                                    className="w-4 shrink-0 text-success"
                                />
                            )}
                        </div>
                    </li>
                    <li>
                        <a
                            onClick={() => setPostShareActed(true)}
                            href={`https://www.facebook.com/sharer/sharer.php?u=${shareLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium"
                        >
                            Share to Facebook
                        </a>
                    </li>
                    <li>
                        <a
                            onClick={() => setPostShareActed(true)}
                            href={`https://twitter.com/intent/tweet?url=${shareLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium"
                        >
                            Share to Twitter
                        </a>
                    </li>
                </ul>
            </div>
        </>
    );
}
