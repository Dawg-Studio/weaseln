"use client";

import { toggleFollowUser } from "@/utils/actions/user";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
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

    async function updateFollowUserStatus() {
        const response = await toggleFollowUser(userId);
        if (response === "following") {
            setUserFollowStatus(true);
        }
        if (response === "unfollowing") {
            setUserFollowStatus(false);
        }
    }
    return (
        <button
            // Same follow language as tags: outlined at rest, rust tint once
            // it is on, so a grid of people is not a wall of rust rectangles.
            className={cn(
                "btn h-9 min-h-9 shrink-0 gap-1.5 rounded-field px-4 text-sm font-semibold text-base-content press",
                userFollowStatus
                    ? "border border-primary/45 bg-tint hover:border-primary hover:bg-tint-strong hover:text-base-content"
                    : "btn-outline border-hairline-strong bg-transparent hover:border-primary hover:bg-tint hover:text-base-content",
            )}
            aria-pressed={userFollowStatus}
            onClick={updateFollowUserStatus}
        >
            {userFollowStatus && (
                <FontAwesomeIcon
                    icon={faCheck}
                    aria-hidden="true"
                    className="w-3 shrink-0 text-primary"
                />
            )}
            {userFollowStatus ? "Following" : "Follow"}
        </button>
    );
}
