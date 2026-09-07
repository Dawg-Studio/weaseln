import type { PostBackground, PostPattern } from "./types";

/**
 * Presentation metadata for the composer's picker.
 *
 * Note what is NOT here: hex values. `profile-customization/visuals.ts` hard-
 * codes swatch colours (`page: "#ffffff"`, `text: "#111827"` …), which are
 * off-system Tailwind greys that drift from the real theme and are simply wrong
 * in dark mode. The picker here paints each swatch from the same
 * `var(--wsl-note-*)` token the real post uses, so a swatch is theme-correct by
 * construction and cannot disagree with what publishing produces.
 */
export type BackgroundSwatch = {
    value: PostBackground;
    label: string;
    /** The CSS custom property the swatch and the post surface both read. */
    token: string;
};

export const BACKGROUND_SWATCHES: BackgroundSwatch[] = [
    { value: "default", label: "Default", token: "var(--color-surface)" },
    { value: "clay", label: "Clay", token: "var(--wsl-note-clay)" },
    { value: "apricot", label: "Apricot", token: "var(--wsl-note-apricot)" },
    { value: "sand", label: "Sand", token: "var(--wsl-note-sand)" },
    { value: "moss", label: "Moss", token: "var(--wsl-note-moss)" },
    { value: "fern", label: "Fern", token: "var(--wsl-note-fern)" },
    { value: "fog", label: "Fog", token: "var(--wsl-note-fog)" },
    { value: "slate", label: "Slate", token: "var(--wsl-note-slate)" },
    { value: "dusk", label: "Dusk", token: "var(--wsl-note-dusk)" },
    { value: "blossom", label: "Blossom", token: "var(--wsl-note-blossom)" },
];

export type PatternOption = {
    value: PostPattern;
    label: string;
};

export const PATTERN_OPTIONS: PatternOption[] = [
    { value: "none", label: "None" },
    { value: "dots", label: "Dots" },
    { value: "grid", label: "Grid" },
    { value: "hatch", label: "Hatch" },
    { value: "wash", label: "Wash" },
];

/**
 * The covers bundled in `public/covers/`. Offering these means an author can
 * satisfy "choose a supported background image" with one click and no
 * Cloudinary credentials — which matters, because `.env` carries no Cloudinary
 * key in local development.
 */
export const BUNDLED_BACKGROUND_IMAGES = [
    { url: "/covers/cover-1.svg", label: "Cover 1" },
    { url: "/covers/cover-2.svg", label: "Cover 2" },
    { url: "/covers/cover-3.svg", label: "Cover 3" },
    { url: "/covers/cover-4.svg", label: "Cover 4" },
] as const;
