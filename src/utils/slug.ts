import { randomBytes } from "crypto";

/**
 * A URL segment that survives a non-latin title. The 4-character suffix is
 * what makes two posts, or two items, with the same title distinct, so a slug
 * is generated once and then never regenerated when the title is edited.
 */
export function slugifyWithSuffix(title: string): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .split(" ")
        .join("-");
    // 3 bytes is exactly 4 base64url characters, so the suffix length is
    // predictable in a URL and in a test.
    const suffix = randomBytes(3).toString("base64url").slice(0, 4);
    return `${slug || "item"}-${suffix}`;
}
