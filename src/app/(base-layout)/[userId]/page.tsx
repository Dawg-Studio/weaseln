import { notFound } from "next/navigation";
import type { FormSocials } from "@/types/user";
import { Metadata } from "next";

import UserOrgProfile from "@/components/user/UserOrgProfile";
import { getProfile, getProfileView } from "@/utils/server/loaders";

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
    const view = await getProfileView(userId);
    if (!view) notFound();

    return (
        <UserOrgProfile
            user={view.user}
            followers={view.followers}
            following={view.following}
            posts={view.posts}
            userId={userId}
            checkIfUserAlreadyFollowed={view.isFollowing}
            customization={view.customization}
            tab="posts"
        />
    );
}
