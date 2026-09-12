import { redirect } from "next/navigation";
import QueryWrapper from "@/components/provider/QueryWrapper";
import NotificationList from "./_components/NotificationList";
import { auth } from "@/auth";
import { signInUrl } from "@/utils/signInUrl";

import prisma from "@/db";

export default async function Notifications() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/notifications"));
    await prisma.userNotifications.updateMany({
        where: {
            userId: session.user.id,
            new: true,
        },
        data: {
            new: false,
        },
    });

    return (
        <QueryWrapper>
            <NotificationList />
        </QueryWrapper>
    );
}
