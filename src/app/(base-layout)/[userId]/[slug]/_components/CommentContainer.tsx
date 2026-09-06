"use client";

import { CommentReaction, PostComment } from "@/generated/prisma/client";
import { generateHTML, JSONContent } from "@tiptap/react";
import Image from "next/image";
import parse from "html-react-parser";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faComment,
    faTrash,
    faUserSlash,
} from "@fortawesome/free-solid-svg-icons";
import {
    Fragment,
    useEffect,
    useOptimistic,
    useState,
    useRef,
    useTransition,
} from "react";
import CommentBox from "./CommentBox";
import useSocket from "@/socket";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ReactionButton from "../../../../../components/reactions/actions/ReactionButton";
import { useSession } from "next-auth/react";
import { isCommentOwner } from "@/utils/actions/comments";
import { deleteComments } from "@/utils/actions/comments";
import Modal from "@/components/ui/Modal";
import tiptapExtensions from "@/utils/tiptapExt";
export default function CommentContainer({
    id,
    userId,
    userName,
    userUsername,
    userImage,
    content,
    createdAt,
    titleId,
    title,
    reactions,
    isRemoved,
}: PostComment & {
    titleId: string;
    title: string;
    reactions?: CommentReaction[];
}) {
    const { data: session } = useSession();
    const socket = useSocket();
    const [commentBoxDisplay, setCommentBoxDisplay] = useState<boolean>(false);
    const [isCommentDelete, setCommentDelete] = useState<boolean>(false);
    // Optimistic view over the committed delete flag. deleteComments has no
    // try/catch of its own and its only non-throwing result is `true`, so a
    // throw IS the failure signal - it is caught below so the transition
    // settles and React reverts to the untouched `isCommentDelete`.
    const [optimisticCommentDelete, applyOptimisticCommentDelete] =
        useOptimistic(isCommentDelete, (_base, next: boolean) => next);
    const [, startTransition] = useTransition();
    const modalDeleteRef = useRef<HTMLDialogElement>(null);
    const [ownComment, setOwnComment] = useState<string>();
    const [ownPost, setOwnPost] = useState<string>();
    const prose = "prose prose-sm sm:prose lg:prose-lg";
    const extensions = tiptapExtensions();
    const postCommentContent = generateHTML(content as JSONContent, extensions);

    const getReplyComments = async () => {
        const params = new URLSearchParams({
            commentId: id,
        });
        const response = await fetch(`/api/comment/reply?${params}`);
        const data = await response.json();
        return data.data as PostComment[];
    };

    const { data, refetch } = useQuery({
        queryKey: ["replyComments", id],
        queryFn: getReplyComments,
    });

    useEffect(() => {
        socket.on("refetchReplies", () => {
            setCommentBoxDisplay(false);
            refetch();
        });
        const getOwnerComment = async () => {
            if (!session) return;

            const { commentOwner, postOwner } = await isCommentOwner(
                session.user.id,
                titleId,
            );
            setOwnComment(commentOwner);
            setOwnPost(postOwner);
        };
        getOwnerComment();

        return () => {
            socket.off("refetchReplies");
        };
    }, [id, refetch, socket, session, session?.user.id, titleId]);

    const deleteCommentBtn = (id: string) => {
        startTransition(async () => {
            applyOptimisticCommentDelete(true);
            try {
                const data = await deleteComments(id);
                setCommentDelete(data);
            } catch (error) {
                // Prisma throws P2025 when the row is already gone.
                // Leaving `isCommentDelete` at false brings the comment
                // back once the transition settles; letting the
                // rejection escape would replace the whole page with
                // global-error.tsx instead.
                console.error(error);
            }
        });
    };
    return (
        <div className="container space-x-6">
            <div className="flex gap-2 items-start">
                <div className="avatar">
                    <div className="rounded-full prose-img:w-full !overflow-visible">
                        <Link href={`/${userUsername ?? userId}`}>
                            {optimisticCommentDelete || isRemoved ? (
                                <FontAwesomeIcon
                                    icon={faUserSlash}
                                    className="rounded-full text-muted"
                                    width={40}
                                    height={40}
                                />
                            ) : (
                                <Image
                                    src={userImage}
                                    alt={userName}
                                    className="rounded-full"
                                    width={40}
                                    height={40}
                                />
                            )}
                        </Link>
                    </div>
                </div>

                <div className="container">
                    {/* `border-2` with no colour resolved to currentColor - a
                        2px near-black frame. One warm 1px hairline instead. */}
                    <div className="mb-4 rounded-box border border-hairline bg-surface p-4 elev-1 focus-within:border-primary">
                        <div className={prose}>
                            {optimisticCommentDelete || isRemoved ? (
                                <div className="flex items-center gap-4">
                                    <p>Comment deleted by user</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Link
                                            href={`/${userUsername ?? userId}`}
                                        >
                                            <p className="text-sm font-bold">
                                                {userName}
                                            </p>
                                        </Link>
                                        <p className="text-meta text-muted nums">
                                            {new Date(createdAt).toDateString()}
                                        </p>
                                    </div>
                                    {parse(`${postCommentContent}`)}
                                </>
                            )}
                        </div>
                    </div>
                    {commentBoxDisplay ||
                    optimisticCommentDelete ||
                    isRemoved ? null : (
                        <div className="mt-4 flex items-center gap-4 pt-3 hairline-t">
                            <div className="flex items-center gap-2">
                                <ReactionButton
                                    target={{ id, authorId: userId }}
                                    targetType="comment"
                                    initialReactionCount={
                                        reactions?.length ?? 0
                                    }
                                />
                            </div>

                            <button
                                type="button"
                                className="btn btn-ghost h-9 min-h-9 w-auto gap-2 rounded-field px-2 text-base-content/70 press hover:bg-base-200 hover:text-base-content"
                                aria-label="Reply to this comment"
                                onClick={() => setCommentBoxDisplay(true)}
                            >
                                <FontAwesomeIcon
                                    icon={faComment}
                                    aria-hidden="true"
                                />
                                <span className="text-meta nums">
                                    {data?.length}
                                </span>
                            </button>
                            {ownComment === userId || ownPost ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-square ml-auto h-9 min-h-9 w-9 rounded-field text-base-content/70 press hover:bg-base-200 hover:text-error"
                                    aria-label="Delete this comment"
                                    onClick={() =>
                                        modalDeleteRef.current?.show()
                                    }
                                >
                                    <FontAwesomeIcon
                                        icon={faTrash}
                                        aria-hidden="true"
                                    />
                                </button>
                            ) : null}
                        </div>
                    )}
                    <Modal ref={modalDeleteRef}>
                        <div className="flex flex-col space-y-4">
                            <h1 className="text-headline text-base-content">
                                Delete Comment
                            </h1>
                            <p className="measure text-sm text-base-content/70">
                                Are you sure you want to delete this comment?
                                This action cannot be undone.
                            </p>
                            <div className="modal-action mt-6 gap-2 pt-4 hairline-t">
                                <form method="dialog">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            className="btn btn-error h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                                            onClick={() => deleteCommentBtn(id)}
                                        >
                                            Delete
                                        </button>
                                        <button
                                            className="btn btn-ghost h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                                            onClick={() => {
                                                modalDeleteRef.current?.close();
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </Modal>
                    <CommentBox
                        titleId={titleId}
                        commentReplyPostId={id}
                        commentReplyPostTitle={title}
                        commentReplyUserId={userId}
                        className={`mt-4 ${
                            commentBoxDisplay ? "block" : "hidden"
                        }`}
                        buttonChildren={
                            <button
                                className="btn btn-outline h-11 min-h-11 rounded-field border-hairline-strong bg-transparent px-5 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint hover:text-base-content"
                                onClick={() => setCommentBoxDisplay(false)}
                            >
                                Cancel
                            </button>
                        }
                    />
                </div>
            </div>
            <div className="mt-4 mb-4">
                {data?.length !== 0 &&
                    data?.map((reply) => (
                        <Fragment key={reply.id}>
                            <CommentContainer
                                {...reply}
                                titleId={titleId}
                                title={title}
                            />
                        </Fragment>
                    ))}
            </div>
        </div>
    );
}
