import { Post } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { faHeart, faComment } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PostBookmark from "./actions/PostBookmark";
import { Fragment, useMemo } from "react";
import timeDiff from "@/utils/timeDiffCalc";
import { cn } from "@/utils/cn";
import { formatPostDate } from "@/utils/formatPostDate";

export default function PostContainer({
    coverImage,
    title,
    titleId,
    description,
    author,
    userId,
    authorUsername,
    authorImage,
    readPerMinute,
    published,
    tags,
    _count,
    createdAt,
    organization,
    organizationId,
}: Post & {
    _count?: {
        reactions: number;
        comments: number;
    };
    organization: {
        id: string;
        name: string;
        image: string;
        username: string;
    } | null;
}) {
    const timeDiffCalc = useMemo(() => {
        return timeDiff(createdAt);
    }, [createdAt]);
    return (
        <div className="flex flex-wrap justify-end p-2 lg:block border-b pb-6 relative">
            <Link
                href={`/${authorUsername ? authorUsername : userId}/${titleId}`}
            >
                <div className="lg:grid lg:grid-cols-2 mx-auto items-center space-y-2 lg:space-y-0">
                    <div className="container space-y-1 break-words">
                        {!published && (
                            <p className="text-sm font-extrabold text-slate-400">
                                UNPUBLISHED
                            </p>
                        )}
                        <div className="flex gap-2 items-center relative">
                            <div className="flex flex-row-reverse items-center gap-1 relative">
                                <div
                                    className={cn("avatar", {
                                        "absolute top-6 left-[25px] z-10":
                                            organizationId,
                                    })}
                                >
                                    <div className="w-7 rounded-full">
                                        <Image
                                            src={authorImage}
                                            alt={author}
                                            width={25}
                                            height={25}
                                        />
                                    </div>
                                </div>
                                {organizationId && organization && (
                                    // ponytail: the org avatar used to be a
                                    // <Link> nested inside the outer post
                                    // <Link>. Nested <a> tags are invalid
                                    // HTML — browsers auto-close the outer
                                    // one, the DOM tree the client sees
                                    // diverges from the server-rendered
                                    // React tree, and React regenerates the
                                    // subtree (hydration mismatch). Use a
                                    // plain <div> here; the org text link
                                    // a few lines down still routes to the
                                    // org page.
                                    <div className="avatar">
                                        <div className="w-12 rounded">
                                            <Image
                                                src={
                                                    organization.image as string
                                                }
                                                alt={
                                                    organization.name as string
                                                }
                                                width={64}
                                                height={64}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="container">
                                {organizationId && organization ? (
                                    // ponytail: was a <Link> nested inside the
                                    // outer post <Link>; nested <a> tags are
                                    // invalid HTML and break React hydration.
                                    // Visit the org page from the org avatar
                                    // badge or its dedicated page instead.
                                    <p>{`${author} for ${organization.name}`}</p>
                                ) : (
                                    <p>{author}</p>
                                )}
                                <p className="text-xs ml-1">
                                    {formatPostDate(new Date(createdAt))}{" "}
                                    ({timeDiffCalc})
                                </p>
                            </div>
                        </div>
                        <h1 className="text-lg lg:text-2xl font-bold">
                            {title}
                        </h1>
                        <p className="text-sm lg:text-md">{description}</p>
                        <div className="!mt-4 space-y-4">
                            {tags && (
                                <div className="flex gap-2 flex-wrap">
                                    {tags.map((tag) => (
                                        <Fragment key={tag}>
                                            <p className="badge badge-sm badge-neutral">
                                                {tag}
                                            </p>
                                        </Fragment>
                                    ))}
                                </div>
                            )}
                            <p className="text-sm text-slate-500">
                                {readPerMinute} min read
                            </p>
                        </div>
                    </div>
                    <figure className="lg:w-9/12 ml-auto float-right rounded-lg overflow-hidden">
                        {coverImage ? (
                            <Image
                                src={coverImage as string}
                                alt="cover_image"
                                width={1920}
                                height={1080}
                                className="rounded-lg"
                            />
                        ) : (
                            // ponytail: post has no cover image. Render a
                            // gradient + title watermark so the feed keeps
                            // its visual rhythm instead of a blank column.
                            <div
                                className="w-full aspect-video bg-gradient-to-br from-base-300 via-base-200 to-base-300 flex items-center justify-center p-6"
                                aria-hidden="true"
                            >
                                <p className="text-base-content/40 text-xl lg:text-3xl font-bold text-center line-clamp-3 max-w-md">
                                    {title}
                                </p>
                            </div>
                        )}
                    </figure>
                </div>
            </Link>
            {/* ponytail: org-link overlay — sibling of the post <Link>, not
                nested. Positioned absolutely over the org avatar area with
                z-20 so it captures clicks there while the post <Link>
                covers everything else. Keeps the org badge clickable
                without breaking React hydration (no nested <a> tags). */}
            {organizationId && organization && (
                <Link
                    href={`/organization/${
                        organization.username ?? organization.id
                    }`}
                    className="absolute z-20"
                    style={{ top: 8, left: 8, width: 48, height: 48 }}
                    aria-label={`Visit ${organization.name}`}
                >
                    <span className="sr-only">{`Visit ${organization.name}`}</span>
                </Link>
            )}
            <div className="flex items-center mt-2 container">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/${
                                    authorUsername ? authorUsername : userId
                                }/${titleId}`}
                            >
                                <FontAwesomeIcon
                                    icon={faHeart}
                                    size="lg"
                                    title="Reactions"
                                />
                            </Link>
                            <div>{_count?.reactions}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon
                                icon={faComment}
                                size="lg"
                                title="Comments"
                            />
                            <div>{_count?.comments}</div>
                        </div>
                    </div>
                </div>
                <PostBookmark titleId={titleId} faSize={"lg"} />
            </div>
        </div>
    );
}
