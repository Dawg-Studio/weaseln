"use client";

import { checkUserLoggedIn } from "@/utils/actions/user";
import { checkBookmarkPostStatus, setBookmarkPost } from "@/utils/actions/post";
import { signIn } from "next-auth/react";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import { faBookmark as FaRegBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useOptimistic, useState, useTransition } from "react";
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
    // The optimistic layer reverts to `bookmarkStatus` when the transition
    // settles, so "don't commit on failure" IS the rollback. setBookmarkPost
    // returns the caught error rather than throwing, so success is checked by
    // sentinel, not by try/catch.
    const [optimisticStatus, applyOptimisticStatus] = useOptimistic(
        bookmarkStatus,
        (_base, next: boolean) => next,
    );
    const [, startTransition] = useTransition();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    //get initial bookmark status
    useEffect(() => {
        checkUserLoggedIn().then((response) =>
            setIsLoggedIn(response.valueOf())
        );
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            checkBookmarkPostStatus(titleId)
                .then((response) => setBookmarkStatus(response?.valueOf() === "bookmarked"))
                // This action returns its caught error instead of a sentinel,
                // and its `await auth()` can reject outright. Either way settle
                // on `false` rather than leaving the status undefined, which
                // would keep the button disabled for good.
                .catch(() => setBookmarkStatus(false));
        }
    }, [isLoggedIn, titleId]);

    function updateBookmarkStatus() {
        // Toggle against what is on screen, so a fast double-click ends up
        // where the user expects rather than replaying the committed value.
        const next = !optimisticStatus;
        startTransition(async () => {
            applyOptimisticStatus(next);
            try {
                const response = await setBookmarkPost(titleId);
                if (response === "bookmarked") {
                    setBookmarkStatus(true);
                }
                if (response === "unbookmarked") {
                    setBookmarkStatus(false);
                }
            } catch (error) {
                // Keep the rejection inside the transition. Letting it
                // escape would have React rethrow it at render and
                // replace the page with global-error.tsx instead of
                // reverting the icon. setBookmarkPost catches its DB
                // work, but its `await auth()` sits outside that try.
                console.error(error);
            }
        });
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
        optimisticStatus &&
            "bg-tint-warm text-base-content hover:bg-tint-warm hover:text-base-content",
        className,
    );

    return (
        <>
            {isLoggedIn ? (
                <button
                    type="button"
                    className={buttonClasses}
                    // Until checkBookmarkPostStatus answers we do not
                    // know which way the toggle goes, and guessing
                    // would show the opposite of the truth. Gate on the
                    // COMMITTED value so a pending transition does not
                    // re-enable it mid-flight.
                    disabled={bookmarkStatus === undefined}
                    aria-pressed={Boolean(optimisticStatus)}
                    aria-label={
                        optimisticStatus
                            ? "Remove from bookmarks"
                            : "Save to bookmarks"
                    }
                    title={optimisticStatus ? "Bookmarked" : "Bookmark"}
                    onClick={updateBookmarkStatus}
                >
                    <FontAwesomeIcon
                        icon={!optimisticStatus ? FaRegBookmark : faBookmark}
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
                        icon={!optimisticStatus ? FaRegBookmark : faBookmark}
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
