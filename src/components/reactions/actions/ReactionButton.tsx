"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { faHeart as FaRegHeart } from "@fortawesome/free-regular-svg-icons";
import {
    getReaction,
    toggleReaction,
    deleteReaction,
} from "@/utils/actions/reactions";
import { UserNotificationInputValidation } from "@/types/notification";
import useSocket from "@/socket";
import { cn } from "@/utils/cn";

type Target = { id: string; authorId: string };

export default function ReactionButton({
    target,
    targetType,
    initialReactionCount,
}: {
    target: Target;
    targetType: "post" | "comment";
    initialReactionCount: number;
}) {
    const { data: session } = useSession();
    const socket = useSocket();
    const pathname = usePathname();
    const [count, setCount] = useState<number>(initialReactionCount);
    const [reaction, setReaction] = useState<string>();
    const key = targetType === "post" ? { postId: target.id } : { commentId: target.id };

    useEffect(() => {
        if (session) {
            getReaction(targetType, key).then((response) => {
                const value = response?.valueOf();
                if (typeof value !== "boolean") {
                    setReaction(value);
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetType, target.id, session?.user.id]);

    async function updateReaction() {
        if (!session) return;

        if (typeof reaction !== "undefined") {
            const removed = await deleteReaction(targetType, key);
            if (removed) {
                setReaction(undefined);
                setCount((prev) => prev - 1);
            }
        } else {
            const added = await toggleReaction(targetType, key, "heart");
            if (added) {
                setReaction("heart");
                setCount((prev) => prev + 1);
                const reactionNotification: UserNotificationInputValidation = {
                    userId: target.authorId,
                    fromUserId: session.user.id,
                    from: session.user.name,
                    fromImage: session.user.image,
                    message:
                        targetType === "post"
                            ? `${session.user.name ?? "Someone"} has reacted with ❤️ to your post`
                            : `${session.user.name ?? "Someone"} has reacted with ❤️ to your comment`,
                    postId: target.id,
                    actionUrl: pathname,
                };
                socket.emit("submitNotification", reactionNotification);
            }
        }
    }

    const onClick = session ? updateReaction : () => signIn();
    const reacted = reaction !== undefined;

    return (
        <>
            <button
                type="button"
                // The glyph and its count are one hit target, so the whole
                // pair lights up together. Rust is the affirmative colour.
                className={cn(
                    "btn btn-ghost h-9 min-h-9 w-auto gap-2 rounded-field px-2 text-base-content/70 press",
                    "hover:bg-base-200 hover:text-base-content",
                    reacted && "text-primary hover:text-primary",
                )}
                aria-pressed={reacted}
                aria-label={
                    reacted
                        ? `Remove your reaction (${count})`
                        : `React with a heart (${count})`
                }
                onClick={onClick}
            >
                <FontAwesomeIcon
                    icon={reaction !== undefined ? faHeart : FaRegHeart}
                    title="Reactions"
                    aria-hidden="true"
                    className="cursor-pointer"
                />
                <span className="nums text-sm font-medium">{count}</span>
            </button>
        </>
    );
}
