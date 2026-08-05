// ponytail: previously called `new Date()` to suppress the year for current-
// year posts. That made the output non-deterministic (server vs client could
// disagree across the new-year boundary) and caused React hydration
// mismatches. Always show the year — explicit dates read better anyway.
export function formatPostDate(d: Date | string, locale?: string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString(locale, {
        month: "short",
        year: "numeric",
        day: "numeric",
    });
}
