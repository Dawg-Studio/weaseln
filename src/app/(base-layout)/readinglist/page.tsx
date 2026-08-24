import PostContainer from "@/components/post/PostContainer";
import prisma from "@/db";

import { postContainerInclude } from "@/utils/prismaQuery";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default async function ReadingList() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    const readingList = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            bookMarks: {
                include: postContainerInclude,
            },
        },
    });

    return (
        <>
            <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
                <h1 className="text-title text-base-content lg:text-display">Reading List</h1>
                <div className="mt-6">
                    {session && readingList?.bookMarks.length !== 0 ? (
                        // PostContainer is now a bordered, elevated card with
                        // no outer margin, so the list owns the gutter — without
                        // it adjacent hairlines touch and read as a 2px rule.
                        <div className="mx-auto max-w-[46rem] space-y-4">
                            {readingList?.bookMarks.map((post) => (
                                <Fragment key={post.id}>
                                    <PostContainer {...post} />
                                </Fragment>
                            ))}
                        </div>
                    ) : (
                        <div className="brand-wash mx-auto flex max-w-[46rem] flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                            <FontAwesomeIcon
                                icon={faBookmark}
                                className="text-3xl text-primary/55"
                            />
                            <h3 className="text-base font-semibold text-base-content">
                                You do not have any reading lists yet.
                            </h3>
                            <p className="measure text-sm text-muted">
                                Bookmark a post and it will be waiting for you
                                right here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
