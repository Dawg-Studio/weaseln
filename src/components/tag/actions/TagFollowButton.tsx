"use client";

import { updateInterest, ifTagFollowing } from "@/utils/actions/tag";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

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

    //get initial follow status
    useEffect(() => {
        ifTagFollowing(tag).then((response) =>
            setTagFollowStatus(response.valueOf()),
        );
    }, [tag]);

    async function updateFollowTagStatus() {
        const response = await updateInterest(tag);
        if (response === "following") {
            setTagFollowStatus(true);
        }
        if (response === "unfollowing") {
            setTagFollowStatus(false);
        }
    }
    return (
        <>
            {isLoggedIn ? (
                <button
                    className={
                        tagFollowStatus
                            ? followingButtonClasses
                            : followButtonClasses
                    }
                    aria-pressed={Boolean(tagFollowStatus)}
                    // keeps the visible word inside the accessible name
                    aria-label={
                        tagFollowStatus
                            ? `Following #${tag}`
                            : `Follow #${tag}`
                    }
                    onClick={updateFollowTagStatus}
                >
                    {tagFollowStatus && (
                        <FontAwesomeIcon
                            icon={faCheck}
                            aria-hidden="true"
                            className="w-3 shrink-0 text-primary"
                        />
                    )}
                    {tagFollowStatus ? "Following" : "Follow"}
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
