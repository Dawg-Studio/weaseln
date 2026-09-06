import PostList from "@/components/post/PostList";
import QueryWrapper from "@/components/provider/QueryWrapper";
import prisma from "@/db";
import { auth } from "@/auth";

import { User } from "@/generated/prisma/client";
import SideMenu from "@/components/menu/SideMenu";
import TagRankingMenu from "@/components/menu/TagRankingMenu";
import WeaselnBgHomepage from "@/components/WeaselnBgHomepage";
import { Suspense } from "react";

export default async function Home() {
    const session = await auth();

    const user = (await prisma.user.findUnique({
        where: { id: session?.user.id ?? "" },
        select: {
            name: true,
            image: true,
            id: true,
            username: true,
        },
    })) as User;

    return (
        <>
            <WeaselnBgHomepage user={user} />
            <main className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
                <div className="flex justify-center gap-6 xl:gap-8">
                    <aside className="hidden lg:block w-1/4 sticky top-20 self-start enter-fade">
                        <SideMenu />
                    </aside>

                    <div className="w-full min-w-0 max-w-[46rem]">
                        <QueryWrapper>
                            <Suspense>
                                <PostList />
                            </Suspense>
                        </QueryWrapper>
                    </div>

                    <aside className="hidden lg:block w-1/4 sticky top-20 self-start enter-fade [--enter-delay:90ms]">
                        <TagRankingMenu />
                    </aside>
                </div>
            </main>
        </>
    );
}
