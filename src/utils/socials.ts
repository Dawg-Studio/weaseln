export type StoredSocial = { name?: string; url?: string };

/**
 * The socials a profile can render. The link below calls `.includes` on the
 * url, so an entry whose url is not a string would throw there.
 */
export function renderableSocials(value: unknown): StoredSocial[] {
    return (Array.isArray(value) ? value : []).filter(
        (entry): entry is StoredSocial =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as { url?: unknown }).url === "string",
    );
}

/**
 * A stored entry is renderable when it is an object and its url is either
 * absent or a string. A row written before the request was validated can
 * hold a number there, and the profile calls `.includes` on it.
 */
function isStoredSocial(entry: unknown): entry is StoredSocial {
    if (!entry || typeof entry !== "object") return false;
    const url = (entry as { url?: unknown }).url;
    return url === undefined || url === null || typeof url === "string";
}

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
    const current = (Array.isArray(existing) ? existing : []).filter(
        isStoredSocial,
    );
    const sentNames = new Set(sent.map((entry) => entry.name ?? ""));
    return [
        ...sent,
        ...current.filter((entry) => !sentNames.has(entry.name ?? "")),
    ];
}
