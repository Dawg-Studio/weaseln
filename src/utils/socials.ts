export type StoredSocial = { name?: string; url?: string };

/**
 * Socials are merged by name: the entries the caller sent replace the stored
 * ones with the same name, and the ones it did not send are kept. A resume
 * adds links to this column, and a form that knows only three of them must
 * not delete the rest.
 */
export function mergeSocialsByName(
    existing: unknown,
    sent: StoredSocial[],
): StoredSocial[] {
    // A stored entry that is not an object is not a social. Rows written
    // before the request was validated can hold one, and keeping it would
    // break the profile that renders the column.
    const current = (
        Array.isArray(existing) ? existing : []
    ).filter(
        (entry): entry is StoredSocial =>
            Boolean(entry) && typeof entry === "object",
    );
    const sentNames = new Set(sent.map((entry) => entry.name ?? ""));
    return [
        ...sent,
        ...current.filter((entry) => !sentNames.has(entry.name ?? "")),
    ];
}
