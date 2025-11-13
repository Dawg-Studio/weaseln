"use client"

import { updateInterest, ifTagFollowing } from "@/utils/actions/tag";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export default function TagFollowButton({ tag, isLoggedIn }: { tag: string, isLoggedIn: boolean }) {
    const [tagFollowStatus, setTagFollowStatus] = useState<boolean>()
    const [isLoading, setIsLoading] = useState<boolean>(false)

    //get initial follow status
    useEffect(() => {
        ifTagFollowing(tag).then(response => setTagFollowStatus(response.valueOf()))
    }, [tag])

    async function updateFollowTagStatus() {
        setIsLoading(true)
        const response = await updateInterest(tag)
        if (response === 'following') {
            setTagFollowStatus(true)
        }
        if (response === 'unfollowing') {
            setTagFollowStatus(false)
        }
        setIsLoading(false)
    }
    return (<>
        {isLoggedIn ? (
            <button className="btn btn-outline" onClick={updateFollowTagStatus} disabled={isLoading}>
                {isLoading && <span className="loading loading-spinner"></span>}
                {tagFollowStatus ? 'Following' : 'Follow'}
            </button>
        ) : (
            <button className="btn btn-outline" onClick={() => signIn()}>Follow</button>
        )}
    </>)
}