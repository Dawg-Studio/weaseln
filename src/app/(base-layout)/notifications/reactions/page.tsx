import QueryWrapper from "@/components/provider/QueryWrapper";
import NotificationList from "../_components/NotificationList";
import { auth } from "@/auth";

import prisma from "@/db";

export default async function NotificationsComments() {
    const session = await auth();
    await prisma.userNotifications.updateMany({
        where: {
            userId: session?.user.id,
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
