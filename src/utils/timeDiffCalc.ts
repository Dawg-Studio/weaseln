// ponytail: user-visible strings changed from hand-rolled pluralization to
// Intl.RelativeTimeFormat with numeric: "auto" (e.g. "last month" instead of
// "1 month ago"). Design sign-off recorded in spec B7, 2026-08-05-resolve-concerns.
const timeDiff = (createdAt: Date | string): string => {
    // ponytail: API responses serialize Date as ISO string; normalize so
    // client components receive either form safely.
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
        { unit: "year", seconds: 31536000 },
        { unit: "month", seconds: 2592000 },
        { unit: "week", seconds: 604800 },
        { unit: "day", seconds: 86400 },
        { unit: "hour", seconds: 3600 },
        { unit: "minute", seconds: 60 },
        { unit: "second", seconds: 1 },
    ];

    for (const { unit, seconds } of units) {
        if (Math.abs(diffSeconds) >= seconds || unit === "second") {
            return rtf.format(Math.round(diffSeconds / seconds), unit);
        }
    }
    return rtf.format(0, "second");
};

export default timeDiff;
