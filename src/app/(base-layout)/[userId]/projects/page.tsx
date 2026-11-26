import type { Metadata } from "next";
import { notFound } from "next/navigation";

import UserOrgProfile from "@/components/user/UserOrgProfile";
import { getProfile, getProfileView } from "@/utils/server/loaders";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ userId: string }>;
}): Promise<Metadata> {
    const { userId } = await params;
    const user = await getProfile(userId);
    if (!user) return { title: "Projects" };

    return {
        title: `Projects — ${user.name ?? user.username}`,
        description: user.bio ?? undefined,
        openGraph: { images: [user.image] },
    };
}

export default async function ProfileProjectsPage({
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
            tab="projects"
        />
    );
}
