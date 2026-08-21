"use client";

import {
    faEllipsis,
    faFeatherPointed,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Post } from "@prisma/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

export default function PostManageTable() {
    const pathName = usePathname();
    const searchParams = useSearchParams();
    const deleteModalWarnRef = useRef<HTMLDialogElement>(null);
    const [selectedPostIdForDeletion, setSelectedPostIdForDeletion] =
        useState<string>("");
    const [orderBy, setOrderBy] = useState<
        | "recent"
        | "unpublished"
        | "most-views"
        | "most-reactions"
        | "most-comments"
    >(
        () =>
            (searchParams.get("sort") as
                | "recent"
                | "unpublished"
                | "most-views"
                | "most-reactions"
                | "most-comments") ?? "recent",
    );
    const { replace } = useRouter();

    const getPosts = async () => {
        const params = new URLSearchParams({
            sort: orderBy,
        });
        const response = await fetch(`/api/post/manage?${params}`);
        const json = await response.json();
        const data = await json.data;
        return data;
    };

    function handleDeleteModalWarn(decision: "delete" | "cancel") {
        if (decision === "delete") {
            mutationDeletePost.mutate();
        }
        if (decision === "cancel") {
            setSelectedPostIdForDeletion("");
        }
    }

    const deletePost = async () => {
        const params = new URLSearchParams({
            postId: selectedPostIdForDeletion,
        });
        const response = await fetch(`/api/post/manage?${params}`, {
            method: "DELETE",
        });
        const json = await response.json();
        if (json) setSelectedPostIdForDeletion("");
        return json;
    };

    const publishOrUnpublishPost = async (
        postId: string,
        publish: "true" | "false",
    ) => {
        const params = new URLSearchParams({
            postId: postId,
            publish: publish,
        });
        const response = await fetch(`/api/post/manage?${params}`, {
            method: "PUT",
        });
        const json = await response.json();
        return json;
    };

    const mutationPublishOrUnpublishPost = useMutation({
        mutationFn: ({
            postId,
            publish,
        }: {
            postId: string;
            publish: "true" | "false";
        }) => publishOrUnpublishPost(postId, publish),
    });

    const mutationDeletePost = useMutation({
        mutationFn: deletePost,
    });

    const { data, refetch, isSuccess, isLoading, isRefetching } = useQuery({
        // ponytail: include orderBy in the key so react-query auto-refetches
        // when the sort changes — no manual refetch() needed in that effect.
        queryKey: ["manage-posts", orderBy],
        queryFn: getPosts,
    });

    // ponytail: previous version of this effect had `searchParams` in the
    // deps list. `replace()` mutates the URL → searchParams reference changes
    // → effect re-fires → infinite /manage/posts?sort=recent loop, hammering
    // the server with /api/post/manage requests. Mirror of the PostList fix.
    useEffect(() => {
        replace(`${pathName}?sort=${orderBy ?? "recent"}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderBy, pathName]);

    // Manual refetch when a mutation completes.
    useEffect(() => {
        if (
            mutationDeletePost.isSuccess ||
            mutationPublishOrUnpublishPost.isSuccess
        ) {
            refetch();
        }
    }, [
        mutationDeletePost.isSuccess,
        mutationPublishOrUnpublishPost.isSuccess,
        refetch,
    ]);

    return (
        <div className="container">
            {/* Same modal shell as components/ui/Modal.tsx: warm ink scrim,
                hairline sheet, elevation from the token ramp. */}
            <dialog
                className="modal open:bg-scrim open:backdrop-blur-[2px]"
                ref={deleteModalWarnRef}
            >
                <div className="modal-box max-w-lg rounded-box border border-hairline bg-surface p-6 elev-4">
                    <h3 className="mb-1 text-headline text-base-content">
                        Delete Post
                    </h3>
                    <p className="measure text-sm text-base-content/70">
                        Are you sure you want to delete this post? This action
                        cannot be undone.
                    </p>
                    <div className="modal-action mt-6 gap-2 pt-4 hairline-t">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <div className="flex justify-center gap-2">
                                <button
                                    className="btn btn-ghost h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                                    onClick={() =>
                                        handleDeleteModalWarn("cancel")
                                    }
                                >
                                    Close
                                </button>
                                <button
                                    className="btn btn-error h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                                    onClick={() =>
                                        handleDeleteModalWarn("delete")
                                    }
                                >
                                    Delete
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <div className="mb-4 flex justify-end">
                <select
                    aria-label="Sort your posts"
                    className="select h-11 w-auto rounded-field border-hairline bg-surface text-base-content transition-[border-color,box-shadow] duration-150 hover:border-hairline-strong focus:border-primary focus:[--input-color:var(--color-primary)]"
                    onChange={(e) =>
                        setOrderBy(
                            e.target.value as
                                | "recent"
                                | "unpublished"
                                | "most-views"
                                | "most-reactions"
                                | "most-comments",
                        )
                    }
                >
                    <option defaultValue="recent" value="recent">
                        Recent
                    </option>
                    <option value="unpublished">Unpublished</option>
                    <option value="most-views">Most Views</option>
                    <option value="most-reactions">Most Reactions</option>
                    <option value="most-comments">Most Comments</option>
                </select>
            </div>
            <div className="overflow-x-auto rounded-box border border-hairline bg-surface elev-1">
                <table className="table table-lg w-full">
                    <tbody>
                        {isSuccess &&
                            data &&
                            data.map((post: Post) => (
                                <Fragment key={post.id}>
                                    <tr className="hairline-b">
                                        <th className="text-base font-semibold text-base-content">
                                            <Link
                                                href={`/${
                                                    post.authorUsername ||
                                                    post.userId
                                                }/${
                                                    post.published
                                                        ? post.titleId
                                                        : `${post.titleId}/edit`
                                                }`}
                                            >
                                                {post.title}
                                            </Link>
                                        </th>
                                        <td>
                                            {/* `badge-neutral` is brand ink
                                                (#2E2016) — a near-black slab.
                                                Status reads as semantic colour
                                                instead. */}
                                            <span
                                                className={
                                                    post.published
                                                        ? "badge badge-sm badge-success font-semibold uppercase tracking-[0.06em]"
                                                        : "badge badge-sm badge-warning font-semibold uppercase tracking-[0.06em]"
                                                }
                                            >
                                                {post.published
                                                    ? "PUBLISHED"
                                                    : "UNPUBLISHED"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex justify-end items-center gap-4">
                                                <button
                                                    className="btn btn-xs btn-outline btn-error rounded-field font-semibold press"
                                                    onClick={() => {
                                                        deleteModalWarnRef.current?.show();
                                                        setSelectedPostIdForDeletion(
                                                            post.id,
                                                        );
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                                <Link
                                                    href={`/${
                                                        post.authorUsername ||
                                                        post.userId
                                                    }/${post.titleId}/edit`}
                                                    className="btn btn-xs btn-outline btn-primary rounded-field font-semibold press"
                                                >
                                                    Edit
                                                </Link>

                                                <div className="dropdown dropdown-left">
                                                    <label
                                                        tabIndex={0}
                                                        aria-label="More actions for this post"
                                                        className="btn btn-ghost btn-square h-9 min-h-9 w-9 rounded-field text-base-content/70 press hover:bg-base-200 hover:text-base-content"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faEllipsis}
                                                            className="cursor-pointer"
                                                            size="lg"
                                                        />
                                                    </label>
                                                    <ul
                                                        tabIndex={0}
                                                        className="dropdown-content z-[1] menu w-52 gap-0.5 rounded-box border border-hairline bg-surface p-2 elev-3"
                                                    >
                                                        <li>
                                                            <button>
                                                                Statistics
                                                            </button>
                                                        </li>
                                                        {post.published ? (
                                                            <li>
                                                                <button
                                                                    onClick={async () => {
                                                                        mutationPublishOrUnpublishPost.mutate(
                                                                            {
                                                                                postId: post.id,
                                                                                publish:
                                                                                    "false",
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    Unpublish
                                                                </button>
                                                            </li>
                                                        ) : (
                                                            <li>
                                                                <button
                                                                    onClick={async () => {
                                                                        mutationPublishOrUnpublishPost.mutate(
                                                                            {
                                                                                postId: post.id,
                                                                                publish:
                                                                                    "true",
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    Publish
                                                                </button>
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </Fragment>
                            ))}
                    </tbody>
                </table>
            </div>
            {/* Outside the table sheet — a dashed empty state must never nest
                inside another surface card. */}
            {data === undefined ||
                ((data as Array<typeof data>).length === 0 &&
                    !isLoading &&
                    !isRefetching && (
                        <div className="brand-wash mt-4 flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                            <FontAwesomeIcon
                                icon={faFeatherPointed}
                                className="text-3xl text-primary/55"
                            />
                            <h3 className="text-base font-semibold text-base-content">
                                No results were found.
                            </h3>
                            <p className="measure text-sm text-muted">
                                Nothing matches this filter yet. Publish a post
                                or pick a different sort.
                            </p>
                        </div>
                    ))}
        </div>
    );
}
