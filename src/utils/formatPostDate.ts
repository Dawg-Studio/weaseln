export function formatPostDate(d: Date, locale?: string): string {
    return d.toLocaleDateString(locale, {
        month: "short",
        year:
            d.getFullYear() === new Date().getFullYear()
                ? undefined
                : "numeric",
        day: "numeric",
    });
}
