import {
    BACKGROUND_POSITIONS,
    BACKGROUND_SIZES,
    BORDER_STYLES,
    CARD_RADIUS,
    CARD_SHADOWS,
    FONT_FAMILIES,
    HEADING_SIZES,
    PROFILE_LAYOUT_VARIANTS,
    PROFILE_PRESETS,
    PROFILE_SECTIONS,
    SPACING_DENSITIES,
    TEXT_ALIGNS,
    type ProfileCustomization,
    type ProfileLayout,
    type ProfileSection,
} from "./types";

export const DEFAULT_PROFILE_LAYOUT: ProfileLayout = {
    variant: "standard",
    sectionOrder: [
        "hero",
        "stats",
        "about",
        "socials",
        "featuredPost",
        "interests",
        "organizations",
        "posts",
    ],
    hiddenSections: [],
};

export const DEFAULT_PROFILE_CUSTOMIZATION: ProfileCustomization = {
    preset: "minimal",
    layout: DEFAULT_PROFILE_LAYOUT,
    backgroundColor: null,
    backgroundImage: null,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundOverlay: null,
    pageGradient: null,
    cardColor: null,
    cardOpacity: 100,
    cardRadius: "medium",
    cardShadow: "subtle",
    borderStyle: "none",
    textColor: null,
    mutedTextColor: null,
    accentColor: null,
    fontFamily: "system",
    headingSize: "large",
    textAlign: "center",
    spacingDensity: "comfortable",
};

const COLOR_PATTERN = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgba?\([^()]*\)|hsla?\([^()]*\))$/;
const MAX_COLOR_LENGTH = 64;
const MAX_URL_LENGTH = 2048;

function fail(message: string): never {
    throw new Error(`Invalid profile customization: ${message}`);
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

function assertOptionalColor(value: unknown, field: string): asserts value is string | null {
    if (value === null || value === undefined) return;
    if (typeof value !== "string") fail(`${field} must be a string or null`);
    if (value.length === 0) fail(`${field} must not be empty`);
    if (value.length > MAX_COLOR_LENGTH) fail(`${field} exceeds ${MAX_COLOR_LENGTH} characters`);
    if (!COLOR_PATTERN.test(value)) {
        fail(`${field} must be a hex, rgb, or hsl color`);
    }
}

function assertBackgroundUrl(
    value: unknown,
    field: string,
): asserts value is string | null {
    if (value === null || value === undefined) return;
    if (typeof value !== "string") fail(`${field} must be a string or null`);
    if (value.length === 0) fail(`${field} must not be empty`);
    if (value.length > MAX_URL_LENGTH) fail(`${field} exceeds ${MAX_URL_LENGTH} characters`);
    if (value.startsWith("/covers/")) return;
    if (value.startsWith("https://res.cloudinary.com/")) return;
    fail(`${field} must start with /covers/ or https://res.cloudinary.com/`);
}

function assertSectionList(
    value: unknown,
    field: string,
): asserts value is ProfileSection[] {
    if (!Array.isArray(value)) fail(`${field} must be an array of sections`);
    const seen = new Set<ProfileSection>();
    for (const entry of value) {
        if (typeof entry !== "string" || !PROFILE_SECTIONS.includes(entry as ProfileSection)) {
            fail(`${field} contains unsupported section "${String(entry)}"`);
        }
        if (seen.has(entry as ProfileSection)) {
            fail(`${field} contains duplicate section "${entry}"`);
        }
        seen.add(entry as ProfileSection);
    }
}

function assertLayout(value: unknown): ProfileLayout {
    if (!isPlainObject(value)) fail("layout must be an object");
    assertOneOf(value.variant, PROFILE_LAYOUT_VARIANTS, "layout.variant");
    assertSectionList(value.sectionOrder, "layout.sectionOrder");
    assertSectionList(value.hiddenSections, "layout.hiddenSections");
    for (const hidden of value.hiddenSections) {
        if (!value.sectionOrder.includes(hidden)) {
            fail(`layout.hiddenSections contains "${hidden}" which is not in sectionOrder`);
        }
    }
    return {
        variant: value.variant,
        sectionOrder: value.sectionOrder,
        hiddenSections: value.hiddenSections,
    };
}

export type ProfileCustomizationInput = Partial<ProfileCustomization>;

export function validateProfileCustomizationInput(
    input: unknown,
): ProfileCustomization {
    if (!isPlainObject(input)) fail("payload must be an object");

    let layout: ProfileLayout;
    if (input.layout === undefined) {
        layout = DEFAULT_PROFILE_LAYOUT;
    } else {
        layout = assertLayout(input.layout);
    }

    if (input.preset !== undefined) {
        assertOneOf(input.preset, PROFILE_PRESETS, "preset");
    }
    if (input.cardOpacity !== undefined) {
        if (
            typeof input.cardOpacity !== "number" ||
            !Number.isInteger(input.cardOpacity) ||
            input.cardOpacity < 0 ||
            input.cardOpacity > 100
        ) {
            fail("cardOpacity must be an integer between 0 and 100");
        }
    }
    if (input.backgroundSize !== undefined) {
        assertOneOf(input.backgroundSize, BACKGROUND_SIZES, "backgroundSize");
    }
    if (input.backgroundPosition !== undefined) {
        assertOneOf(input.backgroundPosition, BACKGROUND_POSITIONS, "backgroundPosition");
    }
    if (input.cardRadius !== undefined) {
        assertOneOf(input.cardRadius, CARD_RADIUS, "cardRadius");
    }
    if (input.cardShadow !== undefined) {
        assertOneOf(input.cardShadow, CARD_SHADOWS, "cardShadow");
    }
    if (input.borderStyle !== undefined) {
        assertOneOf(input.borderStyle, BORDER_STYLES, "borderStyle");
    }
    if (input.fontFamily !== undefined) {
        assertOneOf(input.fontFamily, FONT_FAMILIES, "fontFamily");
    }
    if (input.headingSize !== undefined) {
        assertOneOf(input.headingSize, HEADING_SIZES, "headingSize");
    }
    if (input.textAlign !== undefined) {
        assertOneOf(input.textAlign, TEXT_ALIGNS, "textAlign");
    }
    if (input.spacingDensity !== undefined) {
        assertOneOf(input.spacingDensity, SPACING_DENSITIES, "spacingDensity");
    }

    for (const field of [
        "backgroundColor",
        "backgroundOverlay",
        "pageGradient",
        "cardColor",
        "textColor",
        "mutedTextColor",
        "accentColor",
    ] as const) {
        if (input[field] !== undefined) {
            assertOptionalColor(input[field], field);
        }
    }
    if (input.backgroundImage !== undefined) {
        assertBackgroundUrl(input.backgroundImage, "backgroundImage");
    }

    return {
        ...DEFAULT_PROFILE_CUSTOMIZATION,
        ...input,
        layout,
    };
}