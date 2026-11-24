export const PROFILE_SECTIONS = [
    "hero",
    "stats",
    "about",
    "experience",
    "showcases",
    "socials",
    "featuredPost",
    "interests",
    "organizations",
    "resume",
    "posts",
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/**
 * The sections split by where they render. The profile group stays in the
 * profile card and the facts column and keeps its order; the tabs group has
 * one home each, inside a tab. "posts" is in neither: it is the landing
 * view and is never hidden.
 */
export const PROFILE_SECTION_GROUPS: {
    profile: readonly ProfileSection[];
    tabs: readonly ProfileSection[];
} = {
    profile: ["hero", "stats", "about", "socials", "featuredPost", "interests", "organizations"],
    tabs: ["showcases", "experience", "resume"],
};

export const PROFILE_LAYOUT_VARIANTS = ["standard", "sidebar", "wide"] as const;
export type ProfileLayoutVariant = (typeof PROFILE_LAYOUT_VARIANTS)[number];

export const PROFILE_PRESETS = ["minimal", "editorial", "studio"] as const;
export type ProfilePreset = (typeof PROFILE_PRESETS)[number];

export const BACKGROUND_SIZES = ["cover", "contain", "auto"] as const;
export type BackgroundSize = (typeof BACKGROUND_SIZES)[number];

export const BACKGROUND_POSITIONS = [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top left",
    "top right",
    "bottom left",
    "bottom right",
] as const;
export type BackgroundPosition = (typeof BACKGROUND_POSITIONS)[number];

export const CARD_RADIUS = ["none", "small", "medium", "large", "full"] as const;
export type CardRadius = (typeof CARD_RADIUS)[number];

export const CARD_SHADOWS = ["none", "subtle", "medium", "large"] as const;
export type CardShadow = (typeof CARD_SHADOWS)[number];

export const BORDER_STYLES = ["none", "thin", "thick"] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

export const FONT_FAMILIES = ["system", "serif", "sans", "mono"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const HEADING_SIZES = ["small", "medium", "large"] as const;
export type HeadingSize = (typeof HEADING_SIZES)[number];

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const SPACING_DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type SpacingDensity = (typeof SPACING_DENSITIES)[number];

export type ProfileLayout = {
    variant: ProfileLayoutVariant;
    sectionOrder: ProfileSection[];
    hiddenSections: ProfileSection[];
};

export type ProfileCustomization = {
    preset: ProfilePreset;
    layout: ProfileLayout;
    backgroundColor: string | null;
    backgroundImage: string | null;
    backgroundSize: BackgroundSize;
    backgroundPosition: BackgroundPosition;
    backgroundOverlay: string | null;
    pageGradient: string | null;
    cardColor: string | null;
    cardOpacity: number;
    cardRadius: CardRadius;
    cardShadow: CardShadow;
    borderStyle: BorderStyle;
    textColor: string | null;
    mutedTextColor: string | null;
    accentColor: string | null;
    fontFamily: FontFamily;
    headingSize: HeadingSize;
    textAlign: TextAlign;
    spacingDensity: SpacingDensity;
};