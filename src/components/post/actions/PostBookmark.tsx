"use client";

import { checkUserLoggedIn } from "@/utils/actions/user";
import { checkBookmarkPostStatus, setBookmarkPost } from "@/utils/actions/post";
import { signIn } from "next-auth/react";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import { faBookmark as FaRegBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import type { SizeProp } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/utils/cn";

export default function PostBookmark({
    titleId,
    faSize,
    className,
}: {
    titleId: string;
    faSize?: SizeProp;
    // Optional sizing hook only — lets a caller match the control to the
    // height of the row it sits in. Purely additive; no behaviour change.
    className?: string;
}) {
    const [bookmarkStatus, setBookmarkStatus] = useState<boolean>();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    //get initial bookmark status
    useEffect(() => {
        checkUserLoggedIn().then((response) =>
            setIsLoggedIn(response.valueOf())
        );
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            checkBookmarkPostStatus(titleId).then((response) => {
                const value = response?.valueOf();
                if (value === "bookmarked") {
                    setBookmarkStatus(true);
                }
                if (value === "unbookmarked") {
                    setBookmarkStatus(false);
                }
            });
        }
    }, [isLoggedIn, titleId]);

    async function updateBookmarkStatus() {
        const response = await setBookmarkPost(titleId);
        if (response === "bookmarked") {
            setBookmarkStatus(true);
        }
        if (response === "unbookmarked") {
            setBookmarkStatus(false);
        }
    }

    // Tan is the "set aside for later" colour, but it only clears AA as a
    // FILL, never as a glyph: tan on cream measures 2.14:1 (base-100) and
    // 2.22:1 (surface), which would make the ON state *less* visible than the
    // 5.22:1 OFF state. So the on-state is the warm tan wash carrying an ink
    // glyph; the solid-vs-outline icon swap already encodes the state
    // non-chromatically.
    const buttonClasses = cn(
        "btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-field text-base-content/70 press",
        "hover:bg-base-200 hover:text-base-content",
        bookmarkStatus &&
            "bg-tint-warm text-base-content hover:bg-tint-warm hover:text-base-content",
        className,
    );

    return (
        <>
            {isLoggedIn ? (
                <button
                    type="button"
                    className={buttonClasses}
                    aria-pressed={Boolean(bookmarkStatus)}
                    aria-label={
                        bookmarkStatus
                            ? "Remove from bookmarks"
                            : "Save to bookmarks"
                    }
                    title={bookmarkStatus ? "Bookmarked" : "Bookmark"}
                    onClick={updateBookmarkStatus}
                >
                    <FontAwesomeIcon
                        icon={!bookmarkStatus ? FaRegBookmark : faBookmark}
                        size={faSize}
                        width={20}
                        aria-hidden="true"
                        className="cursor-pointer"
                    />
                </button>
            ) : (
                <button
                    type="button"
                    className={buttonClasses}
                    aria-label="Sign in to save this post"
                    title="Bookmark"
                    onClick={() => signIn()}
                >
                    <FontAwesomeIcon
                        icon={!bookmarkStatus ? FaRegBookmark : faBookmark}
                        width={20}
                        size={faSize}
                        aria-hidden="true"
                        className="cursor-pointer"
                    />
                </button>
            )}
        </>
    );
}
