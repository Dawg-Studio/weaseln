import {
    POST_BACKGROUNDS,
    POST_IMAGE_FITS,
    POST_PATTERNS,
    type PostCustomization,
} from "./types";

export const DEFAULT_POST_CUSTOMIZATION: PostCustomization = {
    backgroundColor: "default",
    backgroundPattern: "none",
    backgroundImage: null,
    backgroundFit: "cover",
};

/** Matches the profile module's cap so the two upload paths agree. */
const MAX_URL_LENGTH = 2048;

/**
 * The only two origins a post background may come from: the four covers bundled
 * in `public/covers/`, and this project's Cloudinary account. Anything else —
 * including `data:`, `javascript:`, protocol-relative `//evil.tld` and any
 * other host — is rejected.
 */
const ALLOWED_URL_PREFIXES = [
    "/covers/",
    "https://res.cloudinary.com/",
] as const;

/**
 * A POSITIVE charset allowlist, not a blocklist.
 *
 * The stored URL is interpolated into a CSS `url("…")` token by `surface.ts`.
 * Listing the characters a legitimate URL may contain — rather than hunting for
 * the ones that break out — means quotes, parentheses, backslashes, whitespace
 * and every control character are excluded by construction, with no escape
 * sequences to get subtly wrong. Both allowed sources produce URLs well inside
 * this set.
 */
const SAFE_URL_PATTERN = /^[A-Za-z0-9._~:/?#@!$&*+,;=%-]+$/;

function fail(message: string): never {
    throw new Error(`Invalid post customization: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOneOf<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    field: string,
): asserts value is T[number] {
    if (typeof value !== "string" || !allowed.includes(value)) {
        fail(`${field} must be one of ${allowed.join(", ")}`);
    }
}

function assertBackgroundUrl(
    value: unknown,
    field: string,
): asserts value is string | null {
    if (value === null || value === undefined) return;
    if (typeof value !== "string") fail(`${field} must be a string or null`);
    if (value.length === 0) fail(`${field} must not be empty`);
    if (value.length > MAX_URL_LENGTH) {
        fail(`${field} exceeds ${MAX_URL_LENGTH} characters`);
    }
    if (!SAFE_URL_PATTERN.test(value)) {
        fail(`${field} contains characters that are not allowed in a URL`);
    }
    if (!ALLOWED_URL_PREFIXES.some((prefix) => value.startsWith(prefix))) {
        fail(`${field} must start with ${ALLOWED_URL_PREFIXES.join(" or ")}`);
    }
}

export type PostCustomizationInput = Partial<PostCustomization>;

export type CustomizationResult =
    | { ok: true; data: Partial<PostCustomization> }
    | { ok: false; message: string };

/**
 * Strict parse: throws on anything unsupported. Use on every write path, so a
 * hostile or malformed value never reaches the database.
 *
 * Absent fields fall back to the default, which means a partial payload is
 * legal and a `{}` payload yields the untouched default appearance.
 */
export function validatePostCustomizationInput(
    input: unknown,
): PostCustomization {
    if (!isPlainObject(input)) fail("payload must be an object");

    if (input.backgroundColor !== undefined) {
        assertOneOf(input.backgroundColor, POST_BACKGROUNDS, "backgroundColor");
    }
    if (input.backgroundPattern !== undefined) {
        assertOneOf(
            input.backgroundPattern,
            POST_PATTERNS,
            "backgroundPattern",
        );
    }
    if (input.backgroundFit !== undefined) {
        assertOneOf(input.backgroundFit, POST_IMAGE_FITS, "backgroundFit");
    }
    if (input.backgroundImage !== undefined) {
        assertBackgroundUrl(input.backgroundImage, "backgroundImage");
    }

    return {
        // Build the persistence object from the allowlisted fields. Spreading
        // `input` here would let arbitrary JSON keys (for example `userId` or
        // `organizationId`) reach a Prisma update alongside these values.
        backgroundColor:
            input.backgroundColor ??
            DEFAULT_POST_CUSTOMIZATION.backgroundColor,
        backgroundPattern:
            input.backgroundPattern ??
            DEFAULT_POST_CUSTOMIZATION.backgroundPattern,
        backgroundImage: input.backgroundImage ?? null,
        backgroundFit:
            input.backgroundFit ?? DEFAULT_POST_CUSTOMIZATION.backgroundFit,
    };
}

/**
 * Parse the optional customization JSON shared by draft autosaves and post
 * publishing. Missing fields preserve the existing route behavior by
 * contributing no Prisma update data; malformed or unsupported values become
 * a caller-facing validation failure.
 */
export function readCustomization(body: FormData): CustomizationResult {
    const field = body.get("customization");
    // The composer stringifies optional fields, so an unset one arrives as the
    // literal "undefined" — the same convention used for coverImage.
    if (
        typeof field !== "string" ||
        field.trim() === "" ||
        field === "undefined"
    ) {
        return { ok: true, data: {} };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(field);
    } catch {
        return {
            ok: false,
            message: "Invalid post customization: payload is not valid JSON",
        };
    }

    try {
        return { ok: true, data: validatePostCustomizationInput(parsed) };
    } catch (err) {
        return {
            ok: false,
            message:
                err instanceof Error
                    ? err.message
                    : "Invalid post customization",
        };
    }
}

/**
 * Lenient parse: never throws. Use on every READ path.
 *
 * A row written by an older deploy, hand-edited in the database, or left behind
 * by a partial migration must degrade to the default appearance rather than
 * crash a feed that renders ten posts at once. Field-by-field rather than
 * all-or-nothing, so one bad column does not discard the others.
 */
export function normalizePostCustomization(input: unknown): PostCustomization {
    if (!isPlainObject(input)) return DEFAULT_POST_CUSTOMIZATION;

    const result: PostCustomization = { ...DEFAULT_POST_CUSTOMIZATION };

    if (
        typeof input.backgroundColor === "string" &&
        (POST_BACKGROUNDS as readonly string[]).includes(input.backgroundColor)
    ) {
        result.backgroundColor =
            input.backgroundColor as PostCustomization["backgroundColor"];
    }
    if (
        typeof input.backgroundPattern === "string" &&
        (POST_PATTERNS as readonly string[]).includes(input.backgroundPattern)
    ) {
        result.backgroundPattern =
            input.backgroundPattern as PostCustomization["backgroundPattern"];
    }
    if (
        typeof input.backgroundFit === "string" &&
        (POST_IMAGE_FITS as readonly string[]).includes(input.backgroundFit)
    ) {
        result.backgroundFit =
            input.backgroundFit as PostCustomization["backgroundFit"];
    }
    try {
        assertBackgroundUrl(input.backgroundImage, "backgroundImage");
        result.backgroundImage =
            (input.backgroundImage as string | null) ?? null;
    } catch {
        result.backgroundImage = null;
    }

    return result;
}

/**
 * True when the customization is indistinguishable from a pre-feature post.
 * `surface.ts` uses this to emit literally nothing, which is what makes the
 * "posts without customization retain the current default appearance"
 * criterion a mechanical fact rather than a visual judgement.
 */
export function isDefaultPostCustomization(
    customization: PostCustomization,
): boolean {
    return (
        customization.backgroundColor === "default" &&
        customization.backgroundPattern === "none" &&
        customization.backgroundImage === null
    );
}
