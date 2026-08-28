"use client";

import { toggleFollowUser } from "@/utils/actions/user";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/utils/cn";

export default function UserFollowButton({
    userId,
    initialFollowStatus,
}: {
    userId: string;
    initialFollowStatus: boolean;
}) {
    const [userFollowStatus, setUserFollowStatus] =
        useState<boolean>(initialFollowStatus);
    // Optimistic view over the committed status: React reverts to
    // `userFollowStatus` once the transition settles, so leaving the committed
    // value alone on a failed round-trip is the rollback.
    const [optimisticFollowStatus, applyOptimisticFollowStatus] = useOptimistic(
        userFollowStatus,
        (_base, next: boolean) => next,
    );
    const [, startTransition] = useTransition();

    function updateFollowUserStatus() {
        // Toggle what the user can see, not the last committed value.
        const next = !optimisticFollowStatus;
        startTransition(async () => {
            applyOptimisticFollowStatus(next);
            try {
                const response = await toggleFollowUser(userId);
                if (response === "following") {
                    setUserFollowStatus(true);
                }
                if (response === "unfollowing") {
                    setUserFollowStatus(false);
                }
            } catch (error) {
                // toggleFollowUser has no try/catch of its own, so an
                // expired session or a DB blip rejects here. Swallow it
                // so the rejection never escapes the transition and
                // reaches global-error.tsx; not committing is the
                // rollback.
                console.error(error);
            }
        });
    }
    return (
        <button
            // Same follow language as tags: outlined at rest, rust tint once
            // it is on, so a grid of people is not a wall of rust rectangles.
            className={cn(
                "btn h-9 min-h-9 shrink-0 gap-1.5 rounded-field px-4 text-sm font-semibold text-base-content press",
                optimisticFollowStatus
                    ? "border border-primary/45 bg-tint hover:border-primary hover:bg-tint-strong hover:text-base-content"
                    : "btn-outline border-hairline-strong bg-transparent hover:border-primary hover:bg-tint hover:text-base-content",
            )}
            aria-pressed={optimisticFollowStatus}
            onClick={updateFollowUserStatus}
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
    );
}
