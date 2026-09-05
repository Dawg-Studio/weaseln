import { redirect } from "next/navigation";

import ProfileCustomizationComponent from "./_components/ProfileCustomization";
import prisma from "@/db";
import { auth } from "@/auth";
import {
    DEFAULT_PROFILE_CUSTOMIZATION,
    normalizeProfileCustomization,
} from "@/modules/profile-customization/validation";
import { type ProfileCustomization } from "@/modules/profile-customization/types";
import { signInUrl } from "@/utils/signInUrl";

export default async function ProfileCustomizationSettings() {
    const session = await auth();
    if (!session?.user) {
        redirect(signInUrl("/settings/profile/customization"));
    }

    let customization: ProfileCustomization = DEFAULT_PROFILE_CUSTOMIZATION;
    const row = await prisma.userProfileCustomization.findUnique({
        where: { userId: session.user.id },
    });
    if (row) {
        customization = normalizeProfileCustomization(row);
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, username: true, image: true },
    });

    return (
        <ProfileCustomizationComponent
            initialCustomization={customization}
            userName={user?.name ?? user?.username ?? "Profile"}
            userImage={user?.image ?? ""}
        />
    );
}
