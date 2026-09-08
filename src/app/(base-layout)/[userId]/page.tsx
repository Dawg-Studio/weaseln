import { notFound } from "next/navigation";
import prisma from "@/db";
import type { FormSocials } from "@/types/user";
import { Fragment } from "react";
import { Metadata } from "next";

import UserOrgProfile from "@/components/user/UserOrgProfile";
import { normalizeProfileCustomization } from "@/modules/profile-customization/validation";
import { getProfile, getSessionUser } from "@/utils/server/loaders";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ userId: string }>;
}): Promise<Metadata> {
    const { userId } = await params;
    const user = await getProfile(userId);
    if (!user) return notFound();
    const websiteUrl = (user?.socials as FormSocials[]).find(
        (social) => social.name === "Personal Website",
    )?.url;

    return {
        title: `${user?.name}`,
        description: user?.bio,
        openGraph: { images: [user?.image as string] },
        twitter: { site: websiteUrl },
    };
}

export default async function ProfilePage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await params;
    const [session, user] = await Promise.all([
        getSessionUser(),
        getProfile(userId),
    ]);

    const followers = user?._count.followedBy;
    const following = user?._count.following;
    const posts = user?._count.post;

    if (!user) {
        notFound();
    }

    const customization = normalizeProfileCustomization(
        user.profileCustomization,
    );

    async function checkUserIfFollowing() {
        if (session) {
            const checkUserFollowed = await prisma.user.findUnique({
                where: {
                    id: session.id,
                    following: {
                        some: {
                            id: user?.id,
                        },
                    },
                },
            });
            if (checkUserFollowed) return true;
            return false;
        }
    }
    const checkIfUserAlreadyFollowed =
        (await checkUserIfFollowing()) as boolean;

    return (
        <Fragment>
            <UserOrgProfile
                user={user}
                followers={followers as number}
                following={following as number}
                posts={posts as number}
                userId={userId}
                checkIfUserAlreadyFollowed={checkIfUserAlreadyFollowed}
                customization={customization}
            />
        </Fragment>
    );
}
