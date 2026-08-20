import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";

type FetcherResult<T> = { items: T[]; nextCursor?: string };

export function useInfiniteList<T>(opts: {
    queryKey: string[];
    fetcher: (
        cursor: string | undefined, // eslint-disable-line no-unused-vars
    ) => Promise<FetcherResult<T>>;
    getNextPageParam?: (
        lastPage: FetcherResult<T>, // eslint-disable-line no-unused-vars
    ) => string | undefined;
    enabled?: boolean;
}) {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isLoading,
        isError,
    } = useInfiniteQuery({
        initialPageParam: "",
        queryKey: opts.queryKey,
        queryFn: ({ pageParam }) => opts.fetcher(pageParam),
        getNextPageParam: opts.getNextPageParam ?? ((last) => last.nextCursor),
        enabled: opts.enabled,
    });

    const { ref, inView } = useInView();

    useEffect(() => {
        if (inView && hasNextPage) fetchNextPage();
    }, [inView, hasNextPage, fetchNextPage]);

    const items = (data?.pages.flatMap((p) => p.items) ?? []) as T[];

    return { items, ref, isLoading, isError, fetchNextPage, hasNextPage };
}
