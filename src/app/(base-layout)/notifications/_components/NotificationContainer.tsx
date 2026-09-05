"use client";

import type { Post, UserNotifications } from "@/generated/prisma/client";
import Image from "next/image";
import Link from "next/link";
import timeDiff from "@/utils/timeDiffCalc";

export default function NotificationContainer({
    from,
    fromImage,
    message,
    post,
    actionUrl,
    createdAt,
}: UserNotifications & {
    post: Post;
}) {
    return (
        // A card is `bg-surface` on the `bg-base-100` page, separated by one
        // warm hairline plus the elevation ramp — never a base-100 card on a
        // base-100 page held apart by a cold neutral drop shadow.
        <Link href={actionUrl} className="block">
            <div className="group relative rounded-box border border-hairline bg-surface p-4 elev-1 lift focus-within:border-primary/45 sm:p-5">
                <div className="flex items-center gap-1">
                    <div className="flex items-center flex-1 gap-2">
                        <div className="avatar">
                            <div className="w-12 rounded-full ring-1 ring-hairline-strong">
                                {from && fromImage && (
                                    <Image
                                        src={fromImage}
                                        alt={from}
                                        height={45}
                                        width={45}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="container">
                            <div className="flex items-center">
                                <div className="container">
                                    <p className="text-sm font-semibold text-base-content break-words">
                                        {from}
                                    </p>
                                    <p className="text-sm text-base-content/70">
                                        {message}
                                        {post && (
                                            <strong> {post.title}</strong>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="justify-end">
                        <p className="text-meta text-muted nums">
                            {timeDiff(createdAt)}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
