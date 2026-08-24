import PostContainer from "@/components/post/PostContainer";
import prisma from "@/db";
import { postContainerInclude } from "@/utils/prismaQuery";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}): Promise<Metadata> {
    const { userId, slug } = await params;
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                {
                    id: userId,
                },
                {
                    username: userId,
                },
            ],
        },
    });
    const postSeries = await prisma.postSeries.findUnique({
        where: {
            id: slug,
            authorId: user?.id,
        },
    });
    return {
        title: `${user?.name}'s Series ${postSeries?.title}`,
        description: postSeries?.description,
        authors: [{ name: user?.name as string }],
    };
}

export default async function SeriesUserPage({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}) {
    const { userId, slug } = await params;
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                {
                    id: userId,
                },
                {
                    username: userId,
                },
            ],
        },
    });
    const postSeries = await prisma.postSeries.findUnique({
        where: {
            id: slug,
            authorId: user?.id,
        },
        include: {
            posts: {
                where: {
                    published: true,
                },
                include: postContainerInclude,
            },
        },
    });
    if (!user || !postSeries) return notFound();

    return (
        <>
            <h1 className="text-title text-base-content lg:text-display">
                {user.name}&apos;s <strong>{postSeries.title}</strong> Series
            </h1>
            {user && postSeries && (
                <div className="mx-auto mt-6 max-w-[46rem] space-y-4">
                    {postSeries.posts.map((post) => (
                        <Fragment key={post.id}>
                            <PostContainer {...post} />
                        </Fragment>
                    ))}
                </div>
            )}
        </>
    );
}
