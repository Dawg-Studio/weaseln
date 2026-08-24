"use client";

import {
    faHashtag,
    faQuestion,
    faPhone,
    faEyeSlash,
    faThumbsUp,
    faMagnifyingGlass,
    faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchBar from "../ui/SearchBar";
import TagRankingMenu from "./TagRankingMenu";
import { cn } from "@/utils/cn";

/* One row geometry for all six links: a 20px icon gutter, a 12px gap and a
   44px tap target, so the glyphs line up on a single vertical rule instead of
   drifting with each icon's intrinsic width. */
const menuRow =
    "group flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium text-base-content/80 transition-colors duration-150 hover:bg-base-200 hover:text-base-content focus-ring";

/* The legal cluster keeps the same size and grid and drops a weight step
   instead — secondary by tone, not by a second type scale. */
const menuRowQuiet = "font-normal text-base-content/70";

const menuIcon =
    "w-5 shrink-0 text-center text-muted transition-colors duration-150 group-hover:text-primary";

const groupLabel = "menu-title px-3 pb-1 text-eyebrow uppercase text-muted";

export default function SideMenu() {
    const pathName = usePathname();

    /* globals.css already styles [aria-current="page"] inside .menu as a rust
       tint carrying base-content text plus a 2px primary rail, so the active
       route needs the attribute and nothing else. */
    function currentPage(href: string): "page" | undefined {
        return pathName === href ? "page" : undefined;
    }

    return (
        <>
            <div className="mb-5 lg:hidden">
                <SearchBar />
            </div>
            {/* The card chrome is lg-only on purpose: below lg this menu only
                ever renders inside the navbar drawer, which is itself a raised
                sheet, and a surface card on a surface panel would nest two
                identical fills. */}
            <nav
                aria-label="Site"
                className="lg:rounded-box lg:border lg:border-hairline lg:bg-surface lg:elev-1 lg:p-3"
            >
                <ul className="menu w-full gap-0.5 rounded-box p-0">
                    <li className={groupLabel}>Explore</li>
                    <li>
                        <Link
                            href={"/tag"}
                            className={menuRow}
                            aria-current={currentPage("/tag")}
                        >
                            <FontAwesomeIcon
                                icon={faHashtag}
                                width={20}
                                className={menuIcon}
                            />
                            Tags
                        </Link>
                    </li>
                    <li>
                        <Link
                            href={"/about"}
                            className={menuRow}
                            aria-current={currentPage("/about")}
                        >
                            <FontAwesomeIcon
                                icon={faQuestion}
                                width={20}
                                className={menuIcon}
                            />
                            About
                        </Link>
                    </li>
                    <li>
                        <Link
                            href={"https://www.facebook.com/leindfraust/"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={menuRow}
                        >
                            <FontAwesomeIcon
                                icon={faPhone}
                                width={20}
                                className={menuIcon}
                            />
                            Contact
                            <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                                className="ms-auto w-3 shrink-0 text-muted transition-colors duration-150 group-hover:text-primary"
                            />
                            <span className="sr-only">
                                (opens in a new tab)
                            </span>
                        </Link>
                    </li>
                    {/* daisyUI paints an empty <li> as its own divider at 10%
                        base-content; restate it in brand tokens so it matches
                        every other rule in the product. */}
                    <li
                        aria-hidden="true"
                        className="mx-3 my-2 h-px bg-hairline opacity-100"
                    ></li>
                    <li className={cn(groupLabel, "pt-3")}>Legal</li>
                    <li>
                        <Link
                            href={"/privacy"}
                            className={cn(menuRow, menuRowQuiet)}
                            aria-current={currentPage("/privacy")}
                        >
                            <FontAwesomeIcon
                                icon={faEyeSlash}
                                width={20}
                                className={menuIcon}
                            />
                            Privacy Policy
                        </Link>
                    </li>
                    <li>
                        <Link
                            href={"/coc"}
                            className={cn(menuRow, menuRowQuiet)}
                            aria-current={currentPage("/coc")}
                        >
                            <FontAwesomeIcon
                                icon={faThumbsUp}
                                width={20}
                                className={menuIcon}
                            />
                            Code of Conduct
                        </Link>
                    </li>
                    <li>
                        <Link
                            href={"/terms"}
                            className={cn(menuRow, menuRowQuiet)}
                            aria-current={currentPage("/terms")}
                        >
                            <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                                width={20}
                                className={menuIcon}
                            />
                            Terms and Conditions
                        </Link>
                    </li>
                </ul>
            </nav>
            <div className="mt-6 hairline-t pt-5 lg:hidden">
                <TagRankingMenu />
            </div>
        </>
    );
}
