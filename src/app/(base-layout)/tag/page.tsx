import TagCard from "@/components/tag/TagCard";
import { auth } from "@/auth";
import { Fragment } from "react";
import { getTagRankings } from "@/utils/actions/tag";

// ponytail: previous version read the cron-populated `tagsRanking`
// snapshot, which is empty on a fresh seed → empty trending-tags page.
// `getTagRankings()` now computes from posts/users directly (see utils/
// actions/tag.ts).
export default async function Tags() {
    const session = await auth();
    const tags = await getTagRankings();

    return (
        <div className="mx-auto mt-12 mb-12 lg:mr-28 lg:ml-28 p-4 lg:p-0">
            <h1 className="text-5xl font-bold">Tags</h1>
            <div className="flex flex-wrap gap-2 mt-8">
                {tags &&
                    tags.map((tag, index: number) => (
                        <Fragment key={index}>
                            <TagCard
                                {...tag}
                                isLoggedIn={session ? true : false}
                            />
                        </Fragment>
                    ))}
            </div>
        </div>
    );
}
