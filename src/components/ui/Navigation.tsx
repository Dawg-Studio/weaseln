"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBars,
    faBell,
    faSun,
    faMoon,
} from "@fortawesome/free-solid-svg-icons";
import { User } from "@prisma/client";
import SideMenu from "../menu/SideMenu";
import SearchBar from "./SearchBar";
import { cn } from "@/utils/cn";
import useSocket from "@/socket";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

/* One recipe for every icon-only control in the bar (drawer, bell, theme
   toggle) so they finally share a size, a radius and a hover. */
const ICON_BUTTON =
    "btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-field text-base-content/70 press hover:bg-base-200 hover:text-base-content";

/* The single filled action in the bar — rust fill, cream label, lit shadow. */
const CTA_BUTTON =
    "btn btn-primary h-11 min-h-11 rounded-field border-0 px-4 text-sm font-semibold elev-1 press hover:elev-2 sm:px-5";

/* Dropdown rows: quiet by default, ink on hover, never a second accent. */
const MENU_ITEM =
    "rounded-field px-3 py-2 text-sm font-medium text-base-content/80 hover:text-base-content";

type NavigationProps = React.HTMLAttributes<HTMLDivElement>;
export default function Navigation({
    name,
    image,
    id,
    username,
    className,
}: User & NavigationProps) {
    const socket = useSocket();

    const { data: session, status } = useSession();

    const getNotifications = async () => {
        const response = await fetch("/api/notification/count");
        const data = await response.json();
        return data.data as number;
    };

    const { data, refetch } = useQuery({
        queryKey: ["notificationsCount"],
        queryFn: getNotifications,
    });

    useEffect(() => {
        socket.on("notifications", (fromUserId) => {
            if (fromUserId === session?.user.id) return;
            refetch();
            const notifBell = new Audio("/audio/notification_bell.aac");
            notifBell.play();
            if (data) {
                toast(`You have ${data + 1} unread notifications`, {
                    id: "notification",
                });
            }
        });

        //need to connect to a socket of session id

        return () => {
            socket.off("notifications");
        };
    }, [data, refetch, session?.user.id, socket]);

    useEffect(() => {
        if (status === "authenticated") {
            socket.emit("initializeSocketNotificationRoom", session?.user.id);
        }
    }, [session?.user.id, socket, status]);

    return (
        <>
            <div
                className={cn(
                    "navbar glass-nav sticky top-0 z-30 min-h-16 gap-1.5 border-b border-hairline px-3 py-0 sm:px-6 lg:px-8",
                    className,
                )}
            >
                <div className="flex-none z-20">
                    <div className="drawer">
                        <input
                            id="sidemenu-drawer"
                            type="checkbox"
                            className="drawer-toggle"
                            aria-label="Open sidebar"
                        />
                        <div className="drawer-content">
                            <label
                                htmlFor="sidemenu-drawer"
                                aria-label="Open sidebar"
                                className={cn("lg:hidden", ICON_BUTTON)}
                            >
                                <FontAwesomeIcon icon={faBars} size="lg" />
                            </label>
                        </div>
                        <div className="drawer-side">
                            <label
                                htmlFor="sidemenu-drawer"
                                aria-label="close sidebar"
                                className="drawer-overlay !cursor-default bg-scrim backdrop-blur-[2px]"
                            ></label>
                            <div className="w-80 min-h-full border-r border-hairline bg-surface p-5 text-base-content elev-4">
                                <SideMenu />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 gap-3 lg:gap-5 flex items-center min-w-0">
                    <Link
                        href={"/"}
                        className="-m-1 flex shrink-0 items-center rounded-field p-1 press"
                    >
                        <Image
                            src={"/icons/weaslnnobg.png"}
                            height={48}
                            width={72}
                            alt="weaseln logo"
                            className="h-9 w-auto sm:h-10"
                        />
                    </Link>
                    <div className="hidden lg:block w-full max-w-sm xl:max-w-md">
                        <SearchBar />
                    </div>
                </div>
                {name && image && id ? (
                    <div className="flex-none flex items-center gap-1 sm:gap-1.5">
                        <ThemeToggleButton />
                        <div className="indicator">
                            <Link
                                href={"/notifications"}
                                aria-label={
                                    data && data > 0
                                        ? `Notifications, ${data} unread`
                                        : "Notifications"
                                }
                                className={ICON_BUTTON}
                                onClick={() => refetch()}
                            >
                                <FontAwesomeIcon icon={faBell} size="lg" />
                            </Link>
                            {data && data > 0 ? (
                                <p
                                    aria-hidden="true"
                                    className="indicator-item badge badge-error h-5 min-w-5 rounded-full border-0 px-1 text-[0.6875rem] font-bold leading-none text-error-content nums ring-2 ring-base-100 [--indicator-x:25%] [--indicator-y:-25%]"
                                >
                                    {data}
                                </p>
                            ) : null}
                        </div>
                        <div className="ml-0.5">
                            <Link href={"/new"}>
                                <button tabIndex={0} className={CTA_BUTTON}>
                                    Create Post
                                </button>
                            </Link>
                        </div>
                        <div className="dropdown dropdown-end">
                            <label
                                tabIndex={0}
                                className="btn btn-ghost btn-circle avatar h-11 min-h-11 w-11 px-0 press"
                            >
                                <div className="w-9 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-base-100 transition-[box-shadow] duration-200 hover:ring-primary/60">
                                    <Image
                                        src={image as string}
                                        alt={name as string}
                                        width={50}
                                        height={50}
                                    />
                                </div>
                            </label>
                            <ul
                                tabIndex={0}
                                className="menu menu-sm dropdown-content mt-3 z-1 gap-0.5 p-2 elev-3 bg-surface border border-hairline rounded-box w-60"
                            >
                                <li>
                                    <Link
                                        href={`/${username || id}`}
                                        className="!block justify-between rounded-field px-3 py-2"
                                    >
                                        <p className="truncate text-sm font-semibold text-base-content">
                                            {name}
                                        </p>
                                        {username && (
                                            <p className="truncate text-meta text-muted">
                                                @{username}
                                            </p>
                                        )}
                                    </Link>
                                </li>
                                <li
                                    aria-hidden="true"
                                    className="mx-1 my-1.5 h-px bg-hairline opacity-100"
                                ></li>
                                <li>
                                    <Link
                                        href={"/manage"}
                                        className={MENU_ITEM}
                                    >
                                        Manage Posts
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={"/readinglist"}
                                        className={MENU_ITEM}
                                    >
                                        Reading List
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={"/settings"}
                                        className={MENU_ITEM}
                                    >
                                        Settings
                                    </Link>
                                </li>
                                <li
                                    aria-hidden="true"
                                    className="mx-1 my-1.5 h-px bg-hairline opacity-100"
                                ></li>
                                <li>
                                    <button
                                        className="rounded-field px-3 py-2 text-sm font-semibold text-error hover:bg-error/10"
                                        onClick={() => signOut()}
                                    >
                                        Sign Out
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="flex-none flex items-center gap-1 sm:gap-1.5">
                        <ThemeToggleButton />
                        <div className="dropdown dropdown-end">
                            <button
                                className={CTA_BUTTON}
                                onClick={() => signIn()}
                            >
                                Login
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export function ThemeToggleButton() {
    const [theme, setTheme] = useState<"light" | "dark">(() =>
        typeof document !== "undefined" &&
        document.documentElement.dataset.theme === "dark"
            ? "dark"
            : "light",
    );

    useEffect(() => {
        const read = () => {
            const current = document.documentElement.dataset.theme;
            if (current === "light" || current === "dark") setTheme(current);
        };
        read();
        const obs = new MutationObserver(read);
        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => obs.disconnect();
    }, []);

    const next = theme === "dark" ? "light" : "dark";
    const label =
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

    return (
        <button
            type="button"
            aria-label={label}
            data-set-theme={next}
            className={cn("group", ICON_BUTTON)}
        >
            <FontAwesomeIcon
                icon={theme === "dark" ? faSun : faMoon}
                size="lg"
                className="transition-transform duration-300 ease-burrow group-hover:rotate-[18deg]"
            />
        </button>
    );
}
