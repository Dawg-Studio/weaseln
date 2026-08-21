import prisma from "@/db";
import type { JSONContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/html";
import parse from "html-react-parser";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Fragment } from "react";
import { auth } from "@/auth";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faComment,
    // faEllipsis,
} from "@fortawesome/free-solid-svg-icons";
import { faComment as faRegComment } from "@fortawesome/free-regular-svg-icons";
import PostSlugWatcher from "@/components/provider/PostSlugWatcher";
import PostBookmark from "@/components/post/actions/PostBookmark";
import CommentBox from "@/app/(base-layout)/[userId]/[slug]/_components/CommentBox";
import QueryWrapper from "@/components/provider/QueryWrapper";
import CommentList from "@/app/(base-layout)/[userId]/[slug]/_components/CommentList";
import NextAuthProvider from "@/components/provider/NextAuthProvider";
import ReactionButton from "@/components/reactions/actions/ReactionButton";
import { PostShareButton } from "@/components/post/PostShareButton";
import { cn } from "@/utils/cn";
import tiptapExtensions from "@/utils/tiptapExt";
import { formatPostDate } from "@/utils/formatPostDate";
import PostList from "@/components/post/PostList";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}): Promise<Metadata> {
    const { userId, slug } = await params;
    const post = await prisma.post.findUnique({
        where: {
            titleId: slug,
            published: true,
            OR: [
                {
                    userId: userId,
                },
                {
                    authorUsername: userId,
                },
            ],
        },
    });
    return {
        title: `${post?.title}`,
        description: post?.description,
        openGraph: { images: [post?.coverImage as string] },
        authors: [{ name: post?.author }],
    };
}

export default async function PostPage({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}) {
    // `measure` (68ch) + `reading` replace the old `max-w-md`, which pinned
    // long-form copy to a 28rem phone column on desktop. globals.css retargets
    // every --tw-prose-* at base-content, so no dark:prose-invert is needed.
    const prose =
        "min-h-screen prose prose-sm sm:prose lg:prose-lg measure reading mx-auto px-4 py-10 sm:px-6 lg:py-12 focus:outline-none";
    const { slug, userId } = await params;
    const post = await prisma.post.findUnique({
        where: {
            titleId: slug,
            published: true,
            OR: [
                {
                    userId: userId,
                },
                {
                    authorUsername: userId,
                },
            ],
        },
        include: {
            _count: {
                select: {
                    reactions: true,
                    comments: true,
                },
            },
            organization: {
                select: {
                    name: true,
                    image: true,
                },
            },
            series: true,
        },
    });
    if (!post) return notFound();

    const session = await auth();
    const isPublisher = (await session?.user.id) === post.userId;

    const user = await prisma.user.findUnique({
        where: { id: session?.user.id ?? "" },
    });

    const extensions = tiptapExtensions();

    const postContent = generateHTML(post?.content as JSONContent, extensions);
    return (
        <PostSlugWatcher postId={post.id}>
            <main className={prose}>
                {isPublisher && (
                    <div className="not-prose mb-6 flex items-center justify-end gap-3">
                        <Link
                            href={`/${user?.username || user?.id}/${
                                post.titleId
                            }/edit`}
                            className="btn btn-ghost h-9 min-h-9 rounded-field px-3 text-sm font-medium text-base-content/70 press hover:bg-base-200 hover:text-base-content"
                        >
                            Edit
                        </Link>
                        {/* daisyUI's `divider` reserves a full 1rem flex row and
                            centres a heavier line — replaced everywhere by the
                            1px warm hairline. */}
                        <span
                            aria-hidden="true"
                            className="h-4 w-px bg-hairline"
                        />
                        <Link
                            href={"/manage"}
                            className="btn btn-ghost h-9 min-h-9 rounded-field px-3 text-sm font-medium text-base-content/70 press hover:bg-base-200 hover:text-base-content"
                        >
                            Manage
                        </Link>
                    </div>
                )}
                {post.series.length !== 0 && (
                    <p className="text-sm text-muted">
                        This is a part of the following series: &nbsp;
                        {post.series.map((series, index) => (
                            <Fragment key={series.id}>
                                {post.series.length !== index + 1 ? (
                                    <strong>
                                        <Link
                                            href={`/${userId}/series/${series.id}`}
                                        >
                                            {series.title}
                                        </Link>
                                        , and{" "}
                                    </strong>
                                ) : (
                                    <strong>
                                        <Link
                                            href={`/${userId}/series/${series.id}`}
                                        >
                                            {series.title}
                                        </Link>
                                    </strong>
                                )}
                            </Fragment>
                        ))}
                    </p>
                )}
                <figure className="not-prose relative my-8 overflow-hidden rounded-box border border-hairline bg-base-200 elev-1">
                    {post?.coverImage ? (
                        <Image
                            src={post.coverImage as string}
                            height={1920}
                            width={1080}
                            alt={`cover image for ${post.title} `}
                            className="cover-crop"
                        />
                    ) : (
                        // ponytail: post has no cover image. Brand wash + title
                        // watermark so the post page keeps its visual rhythm.
                        // Identical treatment to the feed card placeholder in
                        // PostContainer.tsx, so a post looks the same branded
                        // in the feed and when opened.
                        <div
                            className="cover-crop brand-wash brand-dots flex items-center justify-center p-6"
                            aria-hidden="true"
                        >
                            <p className="line-clamp-3 max-w-2xl text-balance text-center text-headline text-base-content/30 lg:text-title">
                                {post.title}
                            </p>
                        </div>
                    )}
                </figure>
                <div className="lg:-space-y-6 -space-y-4">
                    <h1 className="text-title text-base-content lg:text-display">
                        {post?.title}
                    </h1>
                    <h4 className="text-subhead text-muted">
                        {post?.description}
                    </h4>
                    <br />
                    {post.tags.length !== 0 && (
                        <div className="not-prose flex gap-2 flex-wrap">
                            {post.tags.map((tag: string, index: number) => (
                                <Fragment key={index}>
                                    <Link
                                        href={`/tag/${tag}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-hairline bg-base-300 px-2.5 py-1 text-meta font-medium text-base-content/80 transition-colors duration-150 hover:border-primary/45 hover:bg-tint hover:text-base-content focus-ring"
                                    >
                                        #{tag}
                                    </Link>
                                </Fragment>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 items-center not-prose !mt-1 !mb-2 pb-4 hairline-b">
                        {/* <div className="avatar">
                            <div className="rounded-full">
                                <Image
                                    src={post.authorImage}
                                    alt={post.author}
                                    className="rounded-full"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </div> */}
                        <div className="flex flex-row-reverse items-center gap-1 relative">
                            <div
                                className={cn("avatar", {
                                    "absolute top-6 left-[25px] z-10":
                                        post.organizationId,
                                })}
                            >
                                <div className="w-7 rounded-full ring-1 ring-hairline-strong">
                                    <Image
                                        src={post.authorImage}
                                        alt={post.author}
                                        width={25}
                                        height={25}
                                    />
                                </div>
                            </div>
                            {post.organizationId && post.organization && (
                                <div className="avatar">
                                    <div className="w-12 rounded-field ring-2 ring-surface elev-1">
                                        <Image
                                            src={
                                                post.organization
                                                    .image as string
                                            }
                                            alt={
                                                post.organization.name as string
                                            }
                                            width={64}
                                            height={64}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="container">
                            <p className="text-sm text-base-content">
                                <strong>
                                    <Link
                                        href={`/${
                                            post.authorUsername
                                                ? post.authorUsername
                                                : post?.userId
                                        }`}
                                    >
                                        {post?.author}
                                    </Link>
                                </strong>{" "}
                                {post.organization && (
                                    <span>
                                        for{" "}
                                        <strong>
                                            {post.organization.name}
                                        </strong>
                                    </span>
                                )}{" "}
                                · {post?.readPerMinute} min read
                            </p>
                            {new Date(post.updatedAt).toDateString() ===
                            new Date(post.createdAt).toDateString() ? (
                                <p className="text-meta text-muted nums">
                                    Posted on{" "}
                                    {formatPostDate(new Date(post.createdAt))}
                                </p>
                            ) : (
                                <p className="text-meta text-muted nums">
                                    Updated at{" "}
                                    {formatPostDate(new Date(post.updatedAt))}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="not-prose container py-3 hairline-b">
                    <div className="flex items-center">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <ReactionButton
                                        target={{ id: post.id, authorId: post.userId }}
                                        targetType="post"
                                        initialReactionCount={
                                            post._count.reactions
                                        }
                                    />
                                </div>
                                {/* Glyph and count are one control, sized to
                                    the same h-9 baseline as every other action
                                    in the row. */}
                                <div className="flex h-9 items-center gap-2 rounded-field px-2 text-base-content/70">
                                    <FontAwesomeIcon
                                        icon={
                                            post._count.comments !== 0
                                                ? faComment
                                                : faRegComment
                                        }
                                        title="Comments"
                                    />
                                    <div className="text-meta nums">
                                        {post._count.comments}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <PostBookmark
                                titleId={post.titleId}
                                className="h-9 min-h-9 w-9"
                            />
                            <PostShareButton
                                userId={userId}
                                titleId={slug}
                                className="h-9 min-h-9 w-9"
                            />
                            {/* <FontAwesomeIcon icon={faEllipsis} title="More" /> */}
                        </div>
                    </div>
                </div>
                <article>{parse(`${postContent}`)}</article>
                <hr className="my-8 h-px w-full border-0 bg-hairline" />
                <div className="not-prose">
                    <h2 className="brand-rule mb-8 text-headline text-base-content">
                        Comments
                    </h2>
                    <NextAuthProvider>
                        <CommentBox
                            titleId={slug}
                            title={post.title}
                            authorId={post.userId}
                            postId={post.id}
                            className="mb-4"
                        />
                        <QueryWrapper>
                            <CommentList {...post} />
                        </QueryWrapper>
                    </NextAuthProvider>
                </div>
            </main>
            <section className="mx-auto w-full max-w-[88rem] px-4 pb-12 sm:px-6 lg:px-8">
                <hr className="my-8 h-px w-full border-0 bg-hairline" />
                <div className="mx-auto max-w-[46rem]">
                    <h3 className="brand-rule mb-8 text-headline text-base-content">
                        Read Next
                    </h3>
                    <QueryWrapper>
                        <PostList postId={post.id} isHideFeedOpts={true} />
                    </QueryWrapper>
                </div>
            </section>
        </PostSlugWatcher>
    );
}
