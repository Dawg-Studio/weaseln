"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MenuLink } from "@/types/menu";
import { cn } from "@/utils/cn";

export default function LinkMenu({ links }: { links: MenuLink[] }) {
    const router = useRouter();
    const pathName = usePathname();
    const [selectedLink, setSelectedLink] = useState<string>(pathName);

    function selectLink(e: React.ChangeEvent<HTMLSelectElement>) {
        const splitLink = e.currentTarget.value.split("?")[0];
        if (pathName !== splitLink) {
            setSelectedLink(e.currentTarget.value);
            router.push(e.currentTarget.value);
        }
    }

    function activeLink(href: string) {
        const splitLink = href.split("?")[0];
        if (pathName === splitLink) return "active";
    }

    return (
        <>
            <ul className="hidden lg:block lg:sticky lg:top-20 menu menu-lg w-full gap-0.5 rounded-box border border-hairline bg-surface elev-1 p-2">
                {links.map((link) => (
                    <li key={link.href}>
                        {/* activeLink() still supplies its class, but daisyUI 5
                            renamed the menu state to .menu-active, so the
                            visible treatment — rust tint, base-content label,
                            2px primary rail — comes from the
                            [aria-current="page"] rule in globals.css. */}
                        <Link
                            href={link.href}
                            onClick={() => setSelectedLink(link.href)}
                            className={cn(
                                "group flex items-center gap-3 rounded-field px-3 py-2.5 text-base font-medium text-base-content/80 transition-colors duration-150 hover:bg-base-200 hover:text-base-content focus-ring",
                                activeLink(link.href),
                            )}
                            aria-current={
                                activeLink(link.href) ? "page" : undefined
                            }
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
            <select
                aria-label="Section"
                className="select h-11 w-full max-w-xs rounded-field bg-surface text-base font-semibold text-base-content transition-[border-color,box-shadow] duration-150 [--input-color:var(--color-hairline)] hover:[--input-color:var(--color-hairline-strong)] focus:[--input-color:var(--color-primary)] lg:hidden"
                value={selectedLink}
                onChange={selectLink}
            >
                {links.map((link) => (
                    <option key={link.label} value={link.href}>
                        {link.label}
                    </option>
                ))}
            </select>
        </>
    );
}
