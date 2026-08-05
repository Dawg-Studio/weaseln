import prisma from "@/db";

import ProfileSettingsComponent from "@/app/(base-layout)/settings/profile/_components/Profile";
import { User } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfileSettings() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    const user = (await prisma.user.findUnique({
        where: { id: session.user.id },
    })) as User;

    return <ProfileSettingsComponent {...user} />;
}
