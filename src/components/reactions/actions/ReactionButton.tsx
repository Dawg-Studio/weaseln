"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
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

// The committed (server-confirmed) pair the optimistic layer sits on top of.
// Keeping the glyph and its count in ONE state object matters: two separate
// useOptimistic hooks would let a rollback land on one and not the other,
// showing a filled heart over a decremented count.
type ReactionState = { reaction: string | undefined; count: number };

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
    const [state, setState] = useState<ReactionState>({
        reaction: undefined,
        count: initialReactionCount,
    });
    // Which target getReaction has answered for. Storing the key rather than a
    // boolean lets "loaded" be derived during render, so switching target does
    // not need a setState in the effect body to reset the flag.
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    // useOptimistic reverts to `state` when the transition settles, so the
    // rollback on failure is simply "never commit". That only holds if the
    // transition SETTLES: an escaping rejection would be rethrown at render
    // and hit global-error.tsx instead, so every await below is caught.
    const [optimistic, applyOptimistic] = useOptimistic(
        state,
        (_base, next: ReactionState) => next,
    );
    const [, startTransition] = useTransition();
    const key = targetType === "post" ? { postId: target.id } : { commentId: target.id };
    const identity = `${targetType}:${target.id}:${session?.user.id ?? ""}`;
    // Derived, not stored: a change of target invalidates it on its own.
    const reactionLoaded = loadedFor === identity;

    useEffect(() => {
        if (!session) return;

        let cancelled = false;
        getReaction(targetType, key)
            .then((response) => {
                if (cancelled) return;
                const value = response?.valueOf();
                if (typeof value !== "boolean") {
                    setState((prev) => ({ ...prev, reaction: value }));
                }
            })
            // getReaction throws "Unauthorized" on a stale session. Treat that
            // as "nothing to prefill" rather than letting it reject unhandled.
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setLoadedFor(identity);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetType, target.id, session?.user.id]);

    function updateReaction() {
        if (!session) return;

        // Read from the optimistic view, not `state`: a second click that
        // lands before the first round-trip resolves must toggle off what the
        // user can actually see.
        const wasReacted = typeof optimistic.reaction !== "undefined";

        startTransition(async () => {
            try {
                if (wasReacted) {
                    applyOptimistic({
                        reaction: undefined,
                        count: Math.max(0, optimistic.count - 1),
                    });
                    const removed = await deleteReaction(targetType, key);
                    if (removed === true) {
                        setState((prev) => ({
                            reaction: undefined,
                            count: Math.max(0, prev.count - 1),
                        }));
                    }
                    return;
                }

                applyOptimistic({
                    reaction: "heart",
                    count: optimistic.count + 1,
                });
                const added = await toggleReaction(targetType, key, "heart");
                if (added === true) {
                    setState((prev) => ({
                        reaction: "heart",
                        count: prev.count + 1,
                    }));
                    const reactionNotification: UserNotificationInputValidation =
                        {
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
            } catch (error) {
                // These actions throw "Unauthorized" ahead of their own
                // try/catch, and the round-trip itself can reject. Swallowing
                // here keeps the rejection inside the transition: leaving
                // `state` untouched IS the rollback.
                console.error(error);
            }
        });
    }

    const onClick = session ? updateReaction : () => signIn();
    const reacted = optimistic.reaction !== undefined;
    const count = optimistic.count;

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
                // Signed out the button only opens sign-in, so it stays live.
                disabled={Boolean(session) && !reactionLoaded}
                aria-pressed={reacted}
                aria-label={
                    reacted
                        ? `Remove your reaction (${count})`
                        : `React with a heart (${count})`
                }
                onClick={onClick}
            >
                <FontAwesomeIcon
                    icon={reacted ? faHeart : FaRegHeart}
                    title="Reactions"
                    aria-hidden="true"
                    className="cursor-pointer"
                />
                <span className="nums text-sm font-medium">{count}</span>
            </button>
        </>
    );
}
