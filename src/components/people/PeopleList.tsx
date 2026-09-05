"use client";

import { Fragment } from "react";
import PeopleContainer from "./PeopleContainer";
import PeopleContainerLoader from "./PeopleContainerLoader";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type { User } from "@/generated/prisma/client";
import { faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/utils/cn";

// Written out in full so Tailwind's scanner sees every class; the stagger caps
// at the last entry so infinitely appended pages never wait on a growing delay.
const ENTER_DELAYS = [
    "[--enter-delay:0ms]",
    "[--enter-delay:45ms]",
    "[--enter-delay:90ms]",
    "[--enter-delay:135ms]",
];

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
        <div className="space-y-3">
            {/* Only a real fetch shows the shimmer; an empty result set falls
                through to the empty state below instead of stalling on it. */}
            {!isLoading && items.length > 0
                ? items.map((user, index) => (
                      <Fragment key={user.id}>
                          {items.length === index + 1 ? (
                              <div
                                  ref={ref}
                                  className={cn(
                                      "enter",
                                      ENTER_DELAYS[
                                          Math.min(
                                              index,
                                              ENTER_DELAYS.length - 1,
                                          )
                                      ],
                                  )}
                              >
                                  <PeopleContainer {...user} />
                              </div>
                          ) : (
                              <div
                                  className={cn(
                                      "enter",
                                      ENTER_DELAYS[
                                          Math.min(
                                              index,
                                              ENTER_DELAYS.length - 1,
                                          )
                                      ],
                                  )}
                              >
                                  <PeopleContainer {...user} />
                              </div>
                          )}
                      </Fragment>
                  ))
                : isLoading && <PeopleContainerLoader />}
            {keyword && items.length === 0 && !isLoading && (
                <div className="brand-wash enter flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-hairline-strong px-6 py-14 text-center">
                    <FontAwesomeIcon
                        icon={faUserGroup}
                        width={30}
                        className="text-3xl text-primary/55"
                        aria-hidden="true"
                    />
                    <h3 className="text-base font-semibold text-base-content">
                        No results were found.
                    </h3>
                    <p className="measure text-sm text-muted">
                        No one here matches &quot;{keyword}&quot;. Try a name or
                        an @username instead.
                    </p>
                </div>
            )}
            {items.length > 0 && !hasNextPage && !isLoading && (
                <div className="mx-auto flex max-w-md items-center gap-3 pt-6">
                    <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-hairline"
                    />
                    <span className="text-eyebrow uppercase text-muted">
                        End of Results
                    </span>
                    <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-hairline"
                    />
                </div>
            )}
        </div>
    );
}
