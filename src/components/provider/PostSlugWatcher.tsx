"use client";

import {
    addOrUpdateUserPostReadingHistory,
    addPostView,
} from "@/utils/actions/post";
import { useEffect, useRef } from "react";

export default function PostSlugWatcher({
    children,
    postId,
}: {
    children: React.ReactNode;
    postId: string;
}) {
    const readTime = 1000;
    const isViewCounted = useRef<boolean>(false);
    const isActivelyReading = useRef<boolean>(false);
    const readingTimeInterval =
        useRef<ReturnType<typeof setInterval>>(undefined);
    const readTimeCountdown = useRef<NodeJS.Timeout | undefined>(undefined);
    const viewCountTimer =
        useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        viewCountTimer.current = setTimeout(async () => {
            const addViewCount = await addPostView(postId);
            if (addViewCount) isViewCounted.current = true;
        }, 15000);

        const addPostReadingLength = async () => {
            const response = await addOrUpdateUserPostReadingHistory(
                postId,
                readTime,
            );
            if (!response) return;
        };
        const userInactivityCountdown = () => {
            readTimeCountdown.current = setTimeout(() => {
                isActivelyReading.current = false;
                clearInterval(readingTimeInterval.current);
                readingTimeInterval.current = undefined;
            }, 30000);
        };
        const handleScroll = async () => {
            if (isViewCounted.current) {
                if (
                    !readTimeCountdown.current ||
                    readTimeCountdown.current === undefined
                ) {
                    isActivelyReading.current = true;
                    userInactivityCountdown();
                } else {
                    clearTimeout(readTimeCountdown.current);
                    isActivelyReading.current = true;
                    userInactivityCountdown();
                }
            }
            if (isActivelyReading.current) {
                if (
                    !readingTimeInterval.current ||
                    readingTimeInterval === undefined
                ) {
                    readingTimeInterval.current = setInterval(() => {
                        addPostReadingLength();
                    }, readTime);
                }
            }
        };

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (viewCountTimer.current) {
                clearTimeout(viewCountTimer.current);
                viewCountTimer.current = undefined;
            }
            if (readTimeCountdown.current) {
                clearTimeout(readTimeCountdown.current);
                readTimeCountdown.current = undefined;
            }
            if (readingTimeInterval.current) {
                clearInterval(readingTimeInterval.current);
                readingTimeInterval.current = undefined;
            }
        };
    }, [postId]);

    return <>{children}</>;
}
