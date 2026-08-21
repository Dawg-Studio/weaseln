// ponytail: dropped react-loading-skeleton (and its stylesheet) in favour of
// the design system's `shimmer` utility — the library's grey pulse reads as a
// dead block on the cream canvas, and its CSS import fought the theme tokens.
// The silhouette below mirrors PostContainer exactly so nothing reflows when
// the real cards hydrate in.
export default function PostContainerLoader() {
    return (
        <>
            <span className="sr-only" role="status">
                Loading posts
            </span>
            <div className="space-y-4" aria-hidden="true">
                {[0, 1, 2].map((item) => (
                    <div
                        key={item}
                        className="rounded-box border border-hairline bg-surface p-4 elev-1 sm:p-5"
                    >
                        <div className="items-center space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <div className="shimmer size-7 shrink-0 rounded-full" />
                                    <div className="space-y-1.5">
                                        <div className="shimmer h-3 w-28 rounded-field" />
                                        <div className="shimmer h-3 w-20 rounded-field" />
                                    </div>
                                </div>
                                <div className="shimmer mt-4 h-6 w-4/5 rounded-field" />
                                <div className="mt-3 space-y-2">
                                    <div className="shimmer h-4 w-full rounded-field" />
                                    <div className="shimmer h-4 w-3/5 rounded-field" />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <div className="shimmer h-6 w-16 rounded-full" />
                                    <div className="shimmer h-6 w-20 rounded-full" />
                                    <div className="shimmer h-6 w-14 rounded-full" />
                                </div>
                                <div className="shimmer mt-3 h-3 w-24 rounded-field" />
                            </div>
                            <figure className="ml-auto w-full lg:w-9/12">
                                <div className="shimmer cover-crop rounded-box" />
                            </figure>
                        </div>
                        <div className="mt-4 flex items-center gap-4 pt-3 hairline-t">
                            <div className="shimmer h-5 w-14 rounded-field" />
                            <div className="shimmer h-5 w-14 rounded-field" />
                            <div className="shimmer ml-auto size-5 rounded-field" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
