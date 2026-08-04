import prisma from "@/db";

import ProfileSettingsComponent from "@/app/(base-layout)/settings/profile/_components/Profile";
import { User } from "@prisma/client";
import { auth } from "@/auth";

export default async function ProfileSettings() {
    const session = await auth();
    const user = (await prisma.user.findUnique({
        where: { id: session?.user.id },
    })) as User;

    return <ProfileSettingsComponent {...user} />;
}
