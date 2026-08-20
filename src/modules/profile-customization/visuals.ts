import type { ProfilePreset } from "./types";

export type PresetVisual = {
    preset: ProfilePreset;
    label: string;
    blurb: string;
    swatches: {
        page: string;
        surface: string;
        text: string;
        accent: string;
    };
    /** Mini layout descriptor: columns in the hero mockup (1, 2, or 3 visual blocks). */
    blocks: number;
};

export const PRESET_VISUALS: PresetVisual[] = [
    {
        preset: "minimal",
        label: "Minimal",
        blurb: "Clean, quiet, defaults.",
        swatches: {
            page: "#ffffff",
            surface: "#ffffff",
            text: "#111827",
            accent: "#9ca3af",
        },
        blocks: 1,
    },
    {
        preset: "editorial",
        label: "Editorial",
        blurb: "Warm serif, framed cards.",
        swatches: {
            page: "#fef3c7",
            surface: "#fffbeb",
            text: "#7c2d12",
            accent: "#a16207",
        },
        blocks: 2,
    },
    {
        preset: "studio",
        label: "Studio",
        blurb: "Bold contrast, monospace.",
        swatches: {
            page: "#111827",
            surface: "#1f2937",
            text: "#f9fafb",
            accent: "#22d3ee",
        },
        blocks: 3,
    },
];

export type VariantDiagram = {
    variant: "standard" | "sidebar" | "wide";
    label: string;
    blurb: string;
};

/** Ordered for picker display; matches the order in PROFILE_LAYOUT_VARIANTS. */
export const VARIANT_DIAGRAMS: VariantDiagram[] = [
    {
        variant: "standard",
        label: "Standard",
        blurb: "Two-column hero + content below.",
    },
    {
        variant: "sidebar",
        label: "Sidebar",
        blurb: "Sticky stats column on the left.",
    },
    {
        variant: "wide",
        label: "Wide",
        blurb: "Posts span the full width.",
    },
];