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
    const current = Array.isArray(existing)
        ? (existing as StoredSocial[])
        : [];
    const sentNames = new Set(sent.map((entry) => entry.name ?? ""));
    return [
        ...sent,
        ...current.filter((entry) => !sentNames.has(entry.name ?? "")),
    ];
}
