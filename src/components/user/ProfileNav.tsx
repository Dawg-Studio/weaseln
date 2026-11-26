import Link from "next/link";

import { cn } from "@/utils/cn";
import type { ProfileTab } from "./sections";

const TAB_LABELS: Record<ProfileTab, string> = {
    posts: "Posts",
    projects: "Projects",
    resume: "Resume",
};

function tabHref(userId: string, tab: ProfileTab): string {
    return tab === "posts" ? `/${userId}` : `/${userId}/${tab}`;
}

/**
 * The profile navigation. The active tab carries the same surface pill and
 * primary rail the post feed's sort control uses, so it reads as part of the
 * same system rather than a new widget.
 */
export default function ProfileNav({
    userId,
    active,
    tabs,
}: {
    userId: string;
    active: ProfileTab;
    tabs: readonly ProfileTab[];
}) {
    return (
        <nav aria-label="Profile sections" className="mb-6">
            <ul className="flex flex-wrap items-center gap-1 border-b border-hairline">
                {tabs.map((tab) => {
                    const isActive = tab === active;
                    return (
                        <li key={tab}>
                            <Link
                                href={tabHref(userId, tab)}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "relative rounded-field px-3.5 py-2 text-sm font-semibold press focus-ring",
                                    isActive
                                        ? "bg-surface text-base-content elev-1"
                                        : "text-muted hover:bg-base-300 hover:text-base-content",
                                )}
                            >
                                {TAB_LABELS[tab]}
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary transition-opacity duration-200",
                                        isActive ? "opacity-100" : "opacity-0",
                                    )}
                                />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
