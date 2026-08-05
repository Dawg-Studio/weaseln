"use client";

import { Fragment } from "react";
import PeopleContainer from "./PeopleContainer";
import PeopleContainerLoader from "./PeopleContainerLoader";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type { User } from "@prisma/client";

export default function PeopleList({ keyword }: { keyword?: string }) {
    const { items, ref, isLoading, hasNextPage } = useInfiniteList<User>({
        queryKey: ["users", keyword].filter(Boolean) as string[],
        fetcher: async (cursor) => {
            const params = new URLSearchParams({
                q: keyword ?? "",
                cursor: cursor ?? "",
            });
            const response = await fetch(`/api/user?${params}`);
            const json = await response.json();
            return {
                items: json.data?.data ?? [],
                nextCursor: json.data?.metaData?.lastCursor ?? undefined,
            };
        },
    });

    return (
        <div className="space-y-6">
            {!isLoading && items.length > 0 ? (
                items.map((user, index) => (
                    <Fragment key={user.id}>
                        {items.length === index + 1 ? (
                            <div ref={ref}>
                                <PeopleContainer {...user} />
                            </div>
                        ) : (
                            <div>
                                <PeopleContainer {...user} />
                            </div>
                        )}
                    </Fragment>
                ))
            ) : (
                <PeopleContainerLoader />
            )}
            {keyword && items.length === 0 && !isLoading && (
                <h3 className="text-xl">No results were found.</h3>
            )}
            {items.length > 0 && !hasNextPage && !isLoading && (
                <div className=" divider divider-vertical text-sm max-w-md mx-auto">
                    End of Results
                </div>
            )}
        </div>
    );
}
