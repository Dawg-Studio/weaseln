import prisma from "@/db";

import ProfileSettingsComponent from "@/app/(base-layout)/settings/profile/_components/Profile";
import { User } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProfileSettings() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    const user = (await prisma.user.findUnique({
        where: { id: session.user.id },
    })) as User;

    return (
        <>
            <div className="mx-auto lg:w-9/12 pt-6">
                <Link
                    href="/settings/profile/customization"
                    className="link link-primary"
                >
                    Customize profile (colors, background, layout)
                </Link>
            </div>
            <ProfileSettingsComponent {...user} />
        </>
    );
}
