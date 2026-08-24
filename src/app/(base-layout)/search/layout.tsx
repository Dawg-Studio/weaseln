"use client";

import LinkMenu from "@/components/ui/LinkMenu";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SearchMenu = () => {
    const searchParams = useSearchParams();
    const keyword = searchParams.get("q");

    const links = [
        {
            href: `/search/posts?q=${keyword}`,
            label: "Posts",
        },
        {
            href: `/search/people?q=${keyword}`,
            label: "People",
        },
        {
            href: `/search/tags?q=${keyword}`,
            label: "Tags",
        },
    ];
    return <LinkMenu links={links} />;
};

export default function SearchLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div className="lg:flex lg:justify-center lg:gap-8 xl:gap-10">
                <div className="mx-auto mb-6 w-full max-w-xs lg:mx-0 lg:mb-0 lg:w-56 lg:shrink-0 lg:sticky lg:top-20 lg:self-start">
                    <Suspense>
                        <SearchMenu />
                    </Suspense>
                </div>
                <div className="min-w-0 flex-1 enter-fade lg:max-w-[60rem]">
                    {children}
                </div>
            </div>
        </main>
    );
}
