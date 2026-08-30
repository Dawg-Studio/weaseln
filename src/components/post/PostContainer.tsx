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
        // ponytail: `enter` must NOT live on this element. `@utility enter`
        // fills forwards, and its `rise` keyframes animate `transform` — the
        // Animation cascade origin then pins `transform: none` and outranks
        // `lift`'s hover translate, killing the card's motion affordance. The
        // stagger wrapper in PostList.tsx carries `enter` instead.
        <div className="group relative rounded-box border border-hairline bg-surface p-4 elev-1 lift focus-within:border-primary/45 sm:p-5">
            <Link
                href={`/${authorUsername ? authorUsername : userId}/${titleId}`}
                className="block rounded-box"
            >
                <div className="items-center space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                    <div
                        className={cn(
                            "min-w-0 break-words",
                            !coverImage && "lg:col-span-2",
                        )}
                    >
                        {!published && (
                            <p className="mb-3 flex h-5 w-fit items-center rounded-full bg-warning px-2 text-eyebrow uppercase text-warning-content">
                                UNPUBLISHED
                            </p>
                        )}
                        <div className="relative flex items-center gap-3">
                            <div className="relative flex flex-row-reverse items-center gap-1">
                                <div
                                    className={cn("avatar", {
                                        "absolute top-6 left-[25px] z-10":
                                            organizationId,
                                    })}
                                >
                                    <div className="w-7 rounded-full ring-1 ring-hairline-strong">
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
                                        <div className="w-12 rounded-field ring-2 ring-surface elev-1">
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
                            <div className="min-w-0">
                                {organizationId && organization ? (
                                    // ponytail: was a <Link> nested inside the
                                    // outer post <Link>; nested <a> tags are
                                    // invalid HTML and break React hydration.
                                    // Visit the org page from the org avatar
                                    // badge or its dedicated page instead.
                                    <p className="truncate text-sm font-semibold text-base-content">{`${author} for ${organization.name}`}</p>
                                ) : (
                                    <p className="truncate text-sm font-semibold text-base-content">
                                        {author}
                                    </p>
                                )}
                                <p className="text-meta text-muted nums">
                                    {formatPostDate(new Date(createdAt))}
                                    <span
                                        aria-hidden="true"
                                        className="mx-1.5 opacity-60"
                                    >
                                        ·
                                    </span>
                                    {timeDiffCalc}
                                </p>
                            </div>
                        </div>
                        <h1 className="mt-3 text-headline text-base-content transition-colors duration-150 group-hover:text-primary lg:text-title">
                            {title}
                        </h1>
                        <p className="mt-2 line-clamp-2 measure text-subhead text-base-content/70">
                            {description}
                        </p>
                        <div className="mt-4 space-y-3">
                            {tags && (
                                <div className="flex gap-2 flex-wrap">
                                    {tags.map((tag) => (
                                        <Fragment key={tag}>
                                            <p className="inline-flex items-center gap-1 rounded-full border border-hairline bg-base-300 px-2.5 py-1 text-meta font-medium text-base-content/80 transition-colors duration-150 group-hover:border-primary/30">
                                                {tag}
                                            </p>
                                        </Fragment>
                                    ))}
                                </div>
                            )}
                            <p className="text-meta text-muted nums">
                                {readPerMinute} min read
                            </p>
                        </div>
                    </div>
                    {coverImage && (
                        <figure className="relative ml-auto overflow-hidden rounded-box border border-hairline bg-base-200 elev-1 lg:float-right lg:w-9/12">
                            <Image
                                src={coverImage as string}
                                alt="cover_image"
                                width={1920}
                                height={1080}
                                className="cover-crop transition-transform duration-500 ease-out-quint group-hover:scale-[1.03]"
                            />
                        </figure>
                    )}
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
                    className={cn(
                        "absolute left-4 z-20 size-12 rounded-field transition-shadow duration-200 hover:ring-2 hover:ring-primary/55 sm:left-5",
                        published ? "top-4 sm:top-5" : "top-12 sm:top-13",
                    )}
                    aria-label={`Visit ${organization.name}`}
                >
                    <span className="sr-only">{`Visit ${organization.name}`}</span>
                </Link>
            )}
            <div className="mt-4 flex items-center gap-4 pt-3 hairline-t">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/${
                                    authorUsername ? authorUsername : userId
                                }/${titleId}`}
                                className="inline-flex h-9 items-center gap-2 rounded-field px-2 text-base-content/70 press hover:bg-base-200 hover:text-primary"
                                aria-label={`${
                                    _count?.reactions ?? 0
                                } reactions`}
                            >
                                <FontAwesomeIcon
                                    icon={faHeart}
                                    size="lg"
                                    title="Reactions"
                                />
                                <div className="text-meta nums">
                                    {_count?.reactions}
                                </div>
                            </Link>
                        </div>
                        <div className="flex h-9 items-center gap-2 px-2 text-base-content/70">
                            <FontAwesomeIcon
                                icon={faComment}
                                size="lg"
                                title="Comments"
                            />
                            <div className="text-meta nums">
                                {_count?.comments}
                            </div>
                        </div>
                    </div>
                </div>
                {/* No wrapper: the button IS the control. A wrapping span
                    painted its own hover fill under the button's, and boxed a
                    40px control inside a 36px row. Sized to h-9 so it sits on
                    the same baseline as the reaction and comment controls. */}
                <PostBookmark
                    titleId={titleId}
                    faSize={"lg"}
                    className="h-9 min-h-9 w-9"
                />
            </div>
        </div>
    );
}
