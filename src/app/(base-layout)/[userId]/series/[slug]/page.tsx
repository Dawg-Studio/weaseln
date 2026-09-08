import PostContainer from "@/components/post/PostContainer";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getSeries } from "@/utils/server/loaders";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}): Promise<Metadata> {
    const { userId, slug } = await params;
    const postSeries = await getSeries(userId, slug);
    return {
        title: `${postSeries?.author.name}'s Series ${postSeries?.title}`,
        description: postSeries?.description,
        authors: [{ name: postSeries?.author.name as string }],
    };
}

export default async function SeriesUserPage({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}) {
    const { userId, slug } = await params;
    const postSeries = await getSeries(userId, slug);
    if (!postSeries) return notFound();
    const user = postSeries.author;

    return (
        <>
            <h1 className="text-title text-base-content lg:text-display">
                {user.name}&apos;s <strong>{postSeries.title}</strong> Series
            </h1>
            <div className="mx-auto mt-6 max-w-[46rem] space-y-4">
                {postSeries.posts.map((post) => (
                    <Fragment key={post.id}>
                        <PostContainer {...post} />
                    </Fragment>
                ))}
            </div>
        </>
    );
}
