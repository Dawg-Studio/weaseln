"use client";

import { faArrowRight, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
    const router = useRouter();
    const pathName = usePathname();
    const searchParams = useSearchParams();
    const [searchKeyword, setSearchKeyword] = useState<string>(
        searchParams.get("q") ?? "",
    );

    function searchKeywordFn() {
        if (searchKeyword) {
            if (pathName.includes("/search")) {
                router.replace(`${pathName}?q=${searchKeyword}`);
            } else {
                router.push(`/search/posts?q=${searchKeyword}`);
            }
        }
    }

    return (
        <div className="form-control group relative w-full">
            <div className="join w-full">
                <input
                    type="text"
                    placeholder="Search…"
                    className="input join-item h-11 w-full min-w-0 flex-1 bg-surface pl-10 text-base-content transition-[border-color,box-shadow] duration-150 placeholder:text-muted [--input-color:var(--color-hairline)] hover:[--input-color:var(--color-hairline-strong)] focus:[--input-color:var(--color-primary)]"
                    onKeyDown={(e) => e.key === "Enter" && searchKeywordFn()}
                    onChange={(e) => setSearchKeyword(e.currentTarget.value)}
                    value={searchKeyword}
                />
                <button
                    type="button"
                    aria-label="Search"
                    className="btn join-item h-11 min-h-11 border-hairline bg-base-200 px-4 text-base-content press hover:border-primary hover:bg-tint hover:text-base-content"
                    onClick={searchKeywordFn}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </div>
            {/* Leading affordance. Kept outside .join on purpose: a direct child
                would take over :first-child and strip the input's left radius. */}
            <FontAwesomeIcon
                icon={faSearch}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 z-3 -translate-y-1/2 text-muted transition-colors duration-150 group-focus-within:text-primary"
            />
        </div>
    );
}
