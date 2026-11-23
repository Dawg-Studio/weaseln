import {
    EXPERIENCE_KINDS,
    MAX_GALLERY_IMAGES,
    SHOWCASE_LAYOUTS,
    type ExperienceInput,
    type ItemInput,
    type ResumeFacts,
    type ResumeLink,
    type ResumeProposal,
    type ShowcaseInput,
    type ShowcaseLayout,
} from "./types";

// The stored value is interpolated into `src` and into CSS, so the charset is
// an allowlist: a quote or a parenthesis in a "Cloudinary" URL is an injection.
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9\-_./]+$/;
const LOCAL_COVER = "/covers/";
const DATE_PATTERN = /^\d{4}(-\d{2})?$/;
const HTTP_URL = /^https?:\/\/\S+$/;

function fail(message: string): never {
    throw new Error(`Invalid portfolio input: ${message}`);
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

function assertRequiredText(value: unknown, field: string): string {
    if (typeof value !== "string") fail(`${field} must be a string`);
    const trimmed = value.trim();
    if (trimmed.length === 0) fail(`${field} must not be empty`);
    return trimmed;
}

function assertOptionalText(value: unknown, field: string): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") fail(`${field} must be a string or null`);
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}

function assertImageUrl(value: unknown, field: string): string {
    if (typeof value !== "string") fail(`${field} must be a string`);
    if (value.startsWith(LOCAL_COVER) || CLOUDINARY_URL.test(value)) return value;
    fail(`${field} must be a Cloudinary URL or a /covers/ path`);
}

function assertHttpUrl(value: unknown, field: string): string {
    if (typeof value !== "string" || !HTTP_URL.test(value)) {
        fail(`${field} must be an http or https URL`);
    }
    return value;
}

function assertDate(value: unknown, field: string): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
        fail(`${field} must be YYYY or YYYY-MM`);
    }
    return value;
}

function assertStringList(value: unknown, field: string): string[] {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) fail(`${field} must be an array of strings`);
    return value.map((entry) => {
        if (typeof entry !== "string" || entry.trim().length === 0) {
            fail(`${field} must contain non-empty strings`);
        }
        return entry.trim();
    });
}

export function validateShowcaseInput(input: unknown): ShowcaseInput {    if (!isPlainObject(input)) fail("showcase must be an object");
    assertOneOf(input.layout, SHOWCASE_LAYOUTS, "layout");
    return {
        title: assertRequiredText(input.title, "title"),
        description: assertOptionalText(input.description, "description"),
        layout: input.layout,
    };
}

export function validateItemInput(input: unknown): ItemInput {
    if (!isPlainObject(input)) fail("item must be an object");

    const gallery = input.gallery === null || input.gallery === undefined
        ? []
        : input.gallery;
    if (!Array.isArray(gallery)) fail("gallery must be an array");
    if (gallery.length > MAX_GALLERY_IMAGES) {
        fail(`gallery holds at most ${MAX_GALLERY_IMAGES} images`);
    }

    return {
        title: assertRequiredText(input.title, "title"),
        summary: assertOptionalText(input.summary, "summary"),
        description: assertOptionalText(input.description, "description"),
        coverImage:
            input.coverImage === null || input.coverImage === undefined
                ? null
                : assertImageUrl(input.coverImage, "coverImage"),
        gallery: gallery.map((entry) => assertImageUrl(entry, "gallery")),
        link: input.link === null || input.link === undefined ? null : assertHttpUrl(input.link, "link"),
        tags: assertStringList(input.tags, "tags"),
        date: assertOptionalText(input.date, "date"),
    };
}

export function validateExperienceInput(input: unknown): ExperienceInput {
    if (!isPlainObject(input)) fail("experience must be an object");
    assertOneOf(input.kind, EXPERIENCE_KINDS, "kind");

    const startDate = assertDate(input.startDate, "startDate");
    const endDate = assertDate(input.endDate, "endDate");
    const isCurrent = input.isCurrent === true;

    if (isCurrent && endDate !== null) {
        fail("isCurrent must not carry an endDate");
    }

    return {
        kind: input.kind,
        org: assertRequiredText(input.org, "org"),
        role: assertRequiredText(input.role, "role"),
        location: assertOptionalText(input.location, "location"),
        startDate,
        endDate: isCurrent ? null : endDate,
        isCurrent,
        description: assertOptionalText(input.description, "description"),
    };
}

function assertLinks(value: unknown): ResumeLink[] {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) fail("links must be an array");
    return value.map((entry) => {
        if (!isPlainObject(entry)) fail("links must contain objects");
        return {
            label: assertRequiredText(entry.label, "links.label"),
            url: assertHttpUrl(entry.url, "links.url"),
        };
    });
}

export function validateResumeFacts(input: unknown): ResumeFacts {
    if (!isPlainObject(input)) fail("resume facts must be an object");
    return {
        headline: assertOptionalText(input.headline, "headline"),
        summary: assertOptionalText(input.summary, "summary"),
        location: assertOptionalText(input.location, "location"),
        links: assertLinks(input.links),
        skills: assertStringList(input.skills, "skills"),
    };
}

export function validateResumeProposal(input: unknown): ResumeProposal {
    const facts = validateResumeFacts(input);
    if (!isPlainObject(input)) fail("resume proposal must be an object");
    if (!Array.isArray(input.experience)) fail("experience must be an array");
    return {
        ...facts,
        experience: input.experience.map(validateExperienceInput),
    };
}

/**
 * Reads a stored layout the forgiving way: a row written by an older deploy or
 * edited by hand degrades to `grid` instead of rendering nothing.
 */
export function normalizeShowcaseLayout(value: unknown): ShowcaseLayout {
    return typeof value === "string" &&
        (SHOWCASE_LAYOUTS as readonly string[]).includes(value)
        ? (value as ShowcaseLayout)
        : "grid";
}
