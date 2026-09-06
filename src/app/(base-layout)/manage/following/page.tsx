import PeopleContainer from "@/components/people/PeopleContainer";
import TagFollowButton from "@/components/tag/actions/TagFollowButton";
import UserFollowButton from "@/components/user/actions/UserFollowButton";
import prisma from "@/db";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { signInUrl } from "@/utils/signInUrl";

export default async function ManageFollowing() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/manage/following"));

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            following: true,
        },
    });

    const userFollowing = user?.following;
    const userTagInterest = user?.interests;

    return (
        <div className="container">
            <div className="container">
                <h1 className="text-3xl font-bold">People</h1>
                <div className="flex gap-4 mt-4">
                    {userFollowing && userFollowing.length !== 0 ? (
                        <>
                            {userFollowing.map((following) => (
                                <Fragment key={following.id}>
                                    <div className="w-72 rounded-box border border-hairline bg-surface elev-1 lift">
                                        <div className="card-body">
                                            <PeopleContainer {...following} />
                                            <div className="card-actions justify-center">
                                                <UserFollowButton
                                                    userId={following.id}
                                                    initialFollowStatus={true}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Fragment>
                            ))}
                        </>
                    ) : (
                        <p className="text-md">
                            You have not followed anyone yet.
                        </p>
                    )}
                </div>
            </div>

            <div className="container mt-8">
                <h1 className="text-3xl font-bold">Tags</h1>
                <div className="flex gap-4 mt-4">
                    {userTagInterest && userTagInterest.length !== 0 ? (
                        <>
                            {userTagInterest.map((tag) => (
                                <Fragment key={tag}>
                                    <div className="container max-w-xs rounded-box border border-hairline bg-surface p-4 elev-1">
                                        <div className="flex gap-4 items-center justify-center">
                                            <div className="break-words">
                                                <Link href={`/tag/${tag}`}>
                                                    <h2 className="text-2xl font-bold">
                                                        #{tag}
                                                    </h2>
                                                </Link>
                                            </div>
                                            <TagFollowButton
                                                tag={tag}
                                                isLoggedIn={true}
                                            />
                                        </div>
                                    </div>
                                </Fragment>
                            ))}
                        </>
                    ) : (
                        <p className="text-md">
                            You have not followed any tags yet.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
