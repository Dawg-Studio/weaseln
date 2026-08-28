"use client";

import { updateInterest, ifTagFollowing } from "@/utils/actions/tag";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { signIn } from "next-auth/react";
import { useEffect, useOptimistic, useState, useTransition } from "react";

// One follow language across tags and people: outlined at rest, a rust tint
// with a check once it is on — never a solid rust rectangle in a grid.
const followButtonClasses =
    "btn btn-outline h-9 min-h-9 shrink-0 gap-1.5 rounded-field border-hairline-strong bg-transparent px-4 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint hover:text-base-content";
const followingButtonClasses =
    "btn h-9 min-h-9 shrink-0 gap-1.5 rounded-field border border-primary/45 bg-tint px-4 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint-strong hover:text-base-content";

export default function TagFollowButton({
    tag,
    isLoggedIn,
}: {
    tag: string;
    isLoggedIn: boolean;
}) {
    const [tagFollowStatus, setTagFollowStatus] = useState<boolean>();
    // updateInterest swallows its errors and returns the error object, so a
    // failure is "no success sentinel" rather than a throw. Not committing is
    // the rollback: React reverts to `tagFollowStatus` when the transition ends.
    const [optimisticFollowStatus, applyOptimisticFollowStatus] = useOptimistic(
        tagFollowStatus,
        (_base, next: boolean) => next,
    );
    const [, startTransition] = useTransition();

    //get initial follow status
    useEffect(() => {
        ifTagFollowing(tag)
            .then((response) => setTagFollowStatus(response.valueOf()))
            // ifTagFollowing has no try/catch of its own. Settling on `false`
            // keeps the button usable; leaving the status undefined would
            // leave it disabled for good.
            .catch(() => setTagFollowStatus(false));
    }, [tag]);

    function updateFollowTagStatus() {
        // Toggle against the visible state so a rapid second click reverses
        // the first rather than repeating it.
        const next = !optimisticFollowStatus;
        startTransition(async () => {
            applyOptimisticFollowStatus(next);
            try {
                const response = await updateInterest(tag);
                if (response === "following") {
                    setTagFollowStatus(true);
                }
                if (response === "unfollowing") {
                    setTagFollowStatus(false);
                }
            } catch (error) {
                // updateInterest catches its DB work, but its
                // `await auth()` sits outside that try and the
                // round-trip itself can reject. Contain it here so the
                // transition settles and the label reverts.
                console.error(error);
            }
        });
    }
    return (
        <>
            {isLoggedIn ? (
                <button
                    className={
                        optimisticFollowStatus
                            ? followingButtonClasses
                            : followButtonClasses
                    }
                    // Until ifTagFollowing answers we do not know which
                    // way the toggle goes; guessing flashes the wrong
                    // label for an already-followed tag.
                    disabled={tagFollowStatus === undefined}
                    aria-pressed={Boolean(optimisticFollowStatus)}
                    // keeps the visible word inside the accessible name
                    aria-label={
                        optimisticFollowStatus
                            ? `Following #${tag}`
                            : `Follow #${tag}`
                    }
                    onClick={updateFollowTagStatus}
                >
                    {optimisticFollowStatus && (
                        <FontAwesomeIcon
                            icon={faCheck}
                            aria-hidden="true"
                            className="w-3 shrink-0 text-primary"
                        />
                    )}
                    {optimisticFollowStatus ? "Following" : "Follow"}
                </button>
            ) : (
                <button
                    className={followButtonClasses}
                    aria-label={`Sign in to follow #${tag}`}
                    onClick={() => signIn()}
                >
                    Follow
                </button>
            )}
        </>
    );
}
