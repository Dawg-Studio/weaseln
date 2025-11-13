"use client";

import { toggleFollowUser } from "@/utils/actions/user";
import { useState } from "react";

export default function UserFollowButton({
    userId,
    initialFollowStatus,
}: {
    userId: string;
    initialFollowStatus: boolean;
}) {
    const [userFollowStatus, setUserFollowStatus] =
        useState<boolean>(initialFollowStatus);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    async function updateFollowUserStatus() {
        setIsLoading(true);
        const response = await toggleFollowUser(userId);
        if (response === "following") {
            setUserFollowStatus(true);
        }
        if (response === "unfollowing") {
            setUserFollowStatus(false);
        }
        setIsLoading(false);
    }
    return (
        <button
            className={`btn ${
                userFollowStatus ? "btn-primary" : "btn-outline"
            }`}
            onClick={updateFollowUserStatus}
            disabled={isLoading}
        >
            {isLoading && <span className="loading loading-spinner"></span>}
            {userFollowStatus ? "Following" : "Follow"}
        </button>
    );
}
