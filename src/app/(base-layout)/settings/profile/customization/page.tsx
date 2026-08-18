import { redirect } from "next/navigation";

import ProfileCustomizationComponent from "./_components/ProfileCustomization";
import prisma from "@/db";
import { auth } from "@/auth";
import { DEFAULT_PROFILE_CUSTOMIZATION } from "@/modules/profile-customization/validation";
import { type ProfileCustomization } from "@/modules/profile-customization/types";

export default async function ProfileCustomizationSettings() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    let customization: ProfileCustomization = DEFAULT_PROFILE_CUSTOMIZATION;
    const row = await prisma.userProfileCustomization.findUnique({
        where: { userId: session.user.id },
    });
    if (row) {
        // ponytail: schema stores `layout` as Json and color fields as nullable strings;
        // the validator on save guarantees the shape, so the read-through cast is safe.
        customization = row as unknown as ProfileCustomization;
    }

    return <ProfileCustomizationComponent initialCustomization={customization} />;
}
