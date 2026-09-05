"use client";

import useSocket from "@/socket";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import NotificationContainer from "./NotificationContainer";
import { Post, UserNotifications } from "@/generated/prisma/client";
import { usePathname } from "next/navigation";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function NotificationList() {
    const socket = useSocket();
    const pathName = usePathname();
    const segments = pathName.split("/");
    const slug = segments.length === 3 ? segments.at(-1) : undefined;
    const getNotifications = async () => {
        const params = new URLSearchParams({
            ...(slug && {
                q: slug === "reactions" ? "reacted" : "commented | replied",
            }),
        });
        const response = await fetch(`/api/notification?${params}`);
        const data = await response.json();
        return data.data;
    };

    const { data, refetch } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
    });

    useEffect(() => {
        socket.on("notifications", () => {
            refetch();
        });

        return () => {
            socket.off("notifications");
        };
    }, [refetch, socket]);

    return (
        <div className="space-y-4">
            {data &&
                data.length !== 0 &&
                data.map((notification: UserNotifications & { post: Post }) => (
                    <Fragment key={notification.id}>
                        <div className="space-y-4">
                            <NotificationContainer
                                {...notification}
                                post={notification.post}
                            />
                        </div>
                    </Fragment>
                ))}

            {/* ponytail: while `data` is undefined the list used to render an
                empty <div>, so the page flashed blank on every visit. Mirror
                the real row geometry so nothing reflows on hydrate. */}
            {!data && (
                <>
                    <span className="sr-only" role="status">
                        Loading notifications
                    </span>
                    <div aria-hidden="true" className="space-y-4">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 rounded-box border border-hairline bg-surface p-4 elev-1 sm:p-5"
                            >
                                <div className="shimmer size-12 shrink-0 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="shimmer h-4 w-2/5 rounded-field" />
                                    <div className="shimmer h-3 w-4/5 rounded-field" />
                                </div>
                                <div className="shimmer h-3 w-12 rounded-field" />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {data?.length === 0 && (
                <div className="brand-wash flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                    <FontAwesomeIcon
                        icon={faBell}
                        className="text-3xl text-primary/55"
                    />
                    <h3 className="text-base font-semibold text-base-content">
                        No notifications for now.
                    </h3>
                    <p className="measure text-sm text-muted">
                        Reactions, comments and replies on your posts will show
                        up here.
                    </p>
                </div>
            )}
        </div>
    );
}
