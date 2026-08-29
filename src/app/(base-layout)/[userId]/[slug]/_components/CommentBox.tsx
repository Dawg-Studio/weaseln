"use client";

import MenuBar from "../../../../../components/wysiwyg/menu/MenuBar";
import "../../../../../components/wysiwyg/custom_css/placeholder.css";
import { EditorContent, useEditor } from "@tiptap/react";
import TiptapImage from "../../../../../components/wysiwyg/custom_extensions/Image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import Image from "next/image";
import { cn } from "@/utils/cn";
import useSocket from "@/socket";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserNotificationInputValidation } from "@/types/notification";
import tiptapExtensions from "@/utils/tiptapExt";

type CommentBoxProps = React.HTMLAttributes<HTMLDivElement>;

export default function CommentBox({
    titleId,
    title,
    authorId,
    postId,
    buttonChildren,
    commentReplyPostTitle,
    commentReplyPostId,
    commentReplyUserId,
    className,
}: CommentBoxProps & {
    titleId: string;
    title?: string;
    authorId?: string;
    postId?: string;
    commentReplyPostTitle?: string; //only used in notifications
    commentReplyUserId?: string;
    commentReplyPostId?: string;
    buttonChildren?: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const socket = useSocket();
    // Set only when a submit was refused because the socket was down. Purely
    // a notice - it never gates the button, so there is no blocking spinner.
    const [offline, setOffline] = useState<boolean>(false);
    const extensions = tiptapExtensions(["Image", "Link", "Youtube"]);
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            ...extensions,
            Placeholder.configure({
                placeholder: "Type something in here",
            }),
            TiptapImage.configure({
                HTMLAttributes: {
                    class: "mx-auto",
                },
            }),
            TiptapLink.extend({
                inclusive: false,
            }),
            Youtube.configure({
                HTMLAttributes: {
                    class: "mx-auto",
                },
            }),
        ],
        content: "",
        editorProps: {
            attributes: {
                class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto ml-2 mr-2 mt-2 outline-none h-40 overflow-auto",
            },
        },
    });

    // The editor is already cleared optimistically on submit; this stays as
    // the belt-and-braces path for a clear the client did not initiate.
    useEffect(() => {
        socket.on("clearContentCommentBox", () => {
            editor?.commands.clearContent();
        });

        return () => {
            socket.off("clearContentCommentBox");
        };
    }, [editor?.commands, socket, titleId]);

    // Drop the notice as soon as the connection is back, so a stale warning
    // does not sit over a box that can now send. Passing the handler to off()
    // matters here: socket is a shared singleton across every CommentBox.
    useEffect(() => {
        const onConnect = () => setOffline(false);
        socket.on("connect", onConnect);

        return () => {
            socket.off("connect", onConnect);
        };
    }, [socket]);

    function submitComment() {
        if (!session) return;
        if (!editor || !editor.getText() || editor.isEmpty) return;

        // socket.io buffers emits while the connection is down and replays
        // them verbatim on reconnect. Emitting here would leave the draft on
        // screen with nothing to show for it, so every retry click would
        // persist another identical comment. Refuse to send, keep the draft,
        // and say so.
        if (!socket.connected) {
            setOffline(true);
            return;
        }
        setOffline(false);

        const content = editor.getJSON();
        const comment = {
            titleId: titleId,
            userId: session.user.id,
            content: JSON.stringify(content),
            commentReplyPostId: commentReplyPostId,
        };
        if (commentReplyPostId && commentReplyUserId) {
            const commentReplyNotification: UserNotificationInputValidation = {
                userId: commentReplyUserId,
                fromUserId: session.user.id,
                from: session.user.name,
                fromImage: session.user.image,
                message: `has replied to your comment on ${commentReplyPostTitle}`,
                actionUrl: pathname,
            };
            socket.emit("submitNotification", commentReplyNotification);
        }
        if (authorId && title) {
            const commentNotification: UserNotificationInputValidation = {
                userId: authorId,
                fromUserId: session.user.id,
                from: session.user.name,
                fromImage: session.user.image,
                message: `has commented on your post`,
                postId,
                actionUrl: pathname,
            };
            socket.emit("submitNotification", commentNotification);
        }
        socket.emit("submitComment", comment);
        // Clear immediately rather than waiting for the socket to echo back:
        // the payload is already captured in `comment`, and we only get here
        // while connected, so there is nothing left for the draft to protect.
        editor.commands.clearContent();
    }

    return (
        <>
            {session?.user && status === "authenticated" && (
                <div className={cn("container", className)}>
                    <div className="flex gap-2 items-start">
                        <div className="avatar">
                            <div className="rounded-full prose-img:w-full !overflow-visible">
                                {session.user.image ? (
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name ?? "Profile image"}
                                        className="rounded-full"
                                        width={40}
                                        height={40}
                                    />
                                ) : (
                                    <div
                                        className="w-10 h-10 rounded-full bg-base-300 ring-1 ring-hairline-strong"
                                        aria-hidden
                                    />
                                )}
                            </div>
                        </div>
                        <div className="container">
                            {/* `border-2` with no colour resolved to
                                currentColor - a 2px near-black frame. One warm
                                1px hairline and a rust focus instead. */}
                            <div className="rounded-box border border-hairline bg-surface elev-1 focus-within:border-primary">
                                <EditorContent editor={editor} />
                                <MenuBar
                                    editor={editor}
                                    className="w-full"
                                    asComment={true}
                                />
                            </div>
                            <div className="flex justify-start gap-4 mt-4">
                                <button
                                    className="btn btn-primary h-11 min-h-11 rounded-field border-0 px-5 text-sm font-semibold elev-1 press hover:elev-2"
                                    onClick={submitComment}
                                >
                                    Submit
                                </button>
                                {buttonChildren && <>{buttonChildren}</>}
                            </div>
                            {offline && (
                                <p
                                    role="status"
                                    className="mt-2 text-sm text-error"
                                >
                                    Not connected, so your comment was not
                                    sent. It is still here, try again in a
                                    moment.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
