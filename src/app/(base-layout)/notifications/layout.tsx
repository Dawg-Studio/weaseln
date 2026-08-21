import { Metadata } from "next";
import LinkMenu from "@/components/ui/LinkMenu";

export const metadata: Metadata = {
    title: "Notifications",
};

export default async function ManageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const links = [
        {
            href: "/notifications",
            label: "All",
        },
        {
            href: "/notifications/reactions",
            label: "Reactions",
        },
        {
            href: "/notifications/comments",
            label: "Comments",
        },
    ];
    return (
        <main className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div className="lg:flex lg:justify-center lg:gap-8 xl:gap-10">
                <div className="mx-auto mb-6 w-full max-w-xs lg:mx-0 lg:mb-0 lg:w-56 lg:shrink-0 lg:sticky lg:top-20 lg:self-start">
                    <LinkMenu links={links} />
                </div>
                <div className="min-w-0 flex-1 enter-fade lg:max-w-[60rem]">
                    {children}
                </div>
            </div>
        </main>
    );
}
