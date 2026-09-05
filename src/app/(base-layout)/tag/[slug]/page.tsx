
import PostList from "@/components/post/PostList";
import QueryWrapper from "@/components/provider/QueryWrapper";
import PeopleContainer from "@/components/people/PeopleContainer";
import TagFollowButton from "@/components/tag/actions/TagFollowButton";
import prisma from "@/db";
import { User } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";

export default async function TagPosts({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const session = await auth();

    // ponytail: previous version looked the tag up in the cron-populated
    // `tagsRanking` snapshot. That table is empty on a fresh seed, so every
    // tag page 404'd. Compute usage/followers directly from posts/users so
    // the page renders for any tag that exists in the system.
    const [usage, followers, usersWithRelatedTag] = await Promise.all([
        prisma.post.count({ where: { tags: { has: slug } } }),
        prisma.user.count({ where: { interests: { has: slug } } }),
        prisma.user.findMany({
            take: 10,
            where: {
                OR: [
                    { interests: { has: slug } },
                    {
                        post: {
                            some: {
                                tags: { has: slug },
                            },
                        },
                    },
                ],
            },
            orderBy: {
                post: { _count: "desc" },
            },
            select: {
                id: true,
                name: true,
                username: true,
                image: true,
            },
        }),
    ]);

    // Render if the tag is actually used somewhere — posts OR followers.
    // Tags that exist in neither table 404 (unknown / mistyped).
    if (usage === 0 && followers === 0) {
        notFound();
    }

    return (
        <div className="mt-12 mb-12 lg:mr-28 lg:ml-28 p-4 lg:p-0 mx-auto">
            <div className="flex flex-wrap lg:grid lg:grid-cols-2">
                <div className="flex flex-wrap items-center gap-4">
                    <h1 className="text-5xl font-bold">#{slug}</h1>
                    <TagFollowButton
                        tag={slug}
                        isLoggedIn={session ? true : false}
                    />
                </div>
                <div className="container">
                    <h2 className="text-lg lg:text-right">{usage} Posts</h2>
                    <h2 className="text-lg lg:text-right">
                        {followers} Followers
                    </h2>
                </div>
            </div>
            <div className="lg:flex justify-center mt-16">
                <div className="mx-auto">
                    <h2 className="text-lg font-bold">People to Follow</h2>
                    <ul className="menu menu-sm rounded-box">
                        <li>
                            {usersWithRelatedTag &&
                                usersWithRelatedTag.map((user) => (
                                    <Fragment key={user.id}>
                                        <PeopleContainer {...(user as User)} />
                                    </Fragment>
                                ))}
                        </li>
                    </ul>
                </div>
                <div className="flex-1 ml-4 mr-4">
                    <QueryWrapper>
                        <Suspense>
                            <PostList tag={slug} />
                        </Suspense>
                    </QueryWrapper>
                </div>
            </div>
        </div>
    );
}
