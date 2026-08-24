// Mirrors the PeopleContainer card silhouette (64px avatar + name/handle/bio
// stack) so nothing reflows when the real rows hydrate.
const PLACEHOLDER_ROWS = [0, 1, 2];

export default function PeopleContainerLoader() {
    return (
        <>
            <span className="sr-only">Loading people</span>
            <div aria-hidden="true" className="space-y-3">
                {PLACEHOLDER_ROWS.map((row) => (
                    <div
                        key={row}
                        className="flex items-start gap-4 rounded-box border border-hairline bg-surface elev-1 p-4 sm:p-5"
                    >
                        <div className="shimmer size-16 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2.5 py-1">
                            <div className="shimmer h-4 w-40 max-w-full rounded-field" />
                            <div className="shimmer h-3 w-24 max-w-full rounded-field" />
                            <div className="shimmer h-3 w-full rounded-field" />
                            <div className="shimmer h-3 w-3/5 rounded-field" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
