import { describe, expect, it, vi } from "vitest";
import {
    DEFAULT_PROFILE_CUSTOMIZATION,
    DEFAULT_PROFILE_LAYOUT,
    layoutForSave,
    normalizeProfileCustomization,
    validateProfileCustomizationInput,
} from "./validation";

describe("profile customization validation", () => {
    it("uses the approved default section order", () => {
        expect(DEFAULT_PROFILE_LAYOUT.sectionOrder).toEqual([
            "hero", "stats", "about", "experience", "showcases", "socials",
            "featuredPost", "interests", "organizations", "resume", "posts",
        ]);
    });

    it("rejects unknown sections and duplicate sections", () => {
        expect(() => validateProfileCustomizationInput({
            layout: { variant: "wide", sectionOrder: ["hero", "hero"], hiddenSections: ["unknown"] },
        })).toThrow();
    });

    it("rejects unsafe background URLs and out-of-range opacity", () => {
        expect(() => validateProfileCustomizationInput({
            backgroundImage: "javascript:alert(1)", cardOpacity: 101,
        })).toThrow();
    });

    it("rejects a non-undefined invalid layout instead of silently defaulting", () => {
        expect(() => validateProfileCustomizationInput({ layout: "wide" })).toThrow();
        expect(() => validateProfileCustomizationInput({ layout: null })).toThrow();
    });

    it("uses the default layout when layout is omitted", () => {
        const result = validateProfileCustomizationInput({ preset: "minimal" });
        expect(result.layout).toEqual(DEFAULT_PROFILE_LAYOUT);
    });
});

describe("layoutForSave", () => {
    it("keeps every id in the order and never hides posts", () => {
        const saved = layoutForSave({
            variant: "standard",
            sectionOrder: ["hero", "stats", "about", "socials", "featuredPost", "interests", "organizations", "showcases", "experience", "resume", "posts"],
            hiddenSections: ["posts", "organizations"],
        });
        expect(saved.sectionOrder).toHaveLength(11);
        expect(saved.hiddenSections).not.toContain("posts");
        expect(saved.hiddenSections).toContain("organizations");
    });

    it("puts the profile sections first, in the owner's order", () => {
        const saved = layoutForSave({
            variant: "standard",
            sectionOrder: ["stats", "hero", "socials", "about", "featuredPost", "interests", "organizations", "showcases", "experience", "resume", "posts"],
            hiddenSections: [],
        });
        expect(saved.sectionOrder.slice(0, 2)).toEqual(["stats", "hero"]);
        expect(saved.sectionOrder.slice(7)).toEqual([
            "showcases",
            "experience",
            "resume",
            "posts",
        ]);
    });

    it("produces a layout the validator accepts", () => {
        const saved = layoutForSave({
            variant: "standard",
            sectionOrder: ["hero", "posts"],
            hiddenSections: ["posts"],
        });
        expect(() =>
            validateProfileCustomizationInput({ layout: saved }),
        ).not.toThrow();
    });

    it("keeps every id even when the order it is given is short", () => {
        const saved = layoutForSave({
            variant: "standard",
            sectionOrder: ["hero", "posts"],
            hiddenSections: ["posts"],
        });
        expect(saved.sectionOrder).toHaveLength(11);
        expect(new Set(saved.sectionOrder).size).toBe(11);
    });
});

describe("normalizeProfileCustomization", () => {
    it("returns the defaults when input is null or not an object", () => {
        expect(normalizeProfileCustomization(null)).toEqual(
            DEFAULT_PROFILE_CUSTOMIZATION,
        );
        expect(normalizeProfileCustomization("not-an-object")).toEqual(
            DEFAULT_PROFILE_CUSTOMIZATION,
        );
    });

    it("returns the defaults and warns when stored data is malformed", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const result = normalizeProfileCustomization({
            backgroundImage: "javascript:alert(1)",
        });
        expect(result).toEqual(DEFAULT_PROFILE_CUSTOMIZATION);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("returns the defaults and warns when input is an array", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const result = normalizeProfileCustomization(["hero", "stats"]);
        expect(result).toEqual(DEFAULT_PROFILE_CUSTOMIZATION);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("returns a fully validated customization when stored data is valid", () => {
        const result = normalizeProfileCustomization({
            preset: "editorial",
            backgroundColor: "#ff00ff",
        });
        expect(result.preset).toBe("editorial");
        expect(result.backgroundColor).toBe("#ff00ff");
    });

    it("falls back to defaults when a partially-malformed row is loaded", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const result = normalizeProfileCustomization({
            preset: "editorial",
            layout: "not-an-object",
            backgroundColor: "#ff00ff",
            cardOpacity: 999,
        });
        expect(result).toEqual(DEFAULT_PROFILE_CUSTOMIZATION);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
describe("portfolio sections", () => {
    it("appends sections a stored layout predates", () => {
        const stored = {
            layout: {
                variant: "standard",
                sectionOrder: ["hero", "posts"],
                hiddenSections: ["posts"],
            },
        };
        const next = normalizeProfileCustomization(stored);
        expect(next.layout.sectionOrder.slice(0, 2)).toEqual(["hero", "posts"]);
        expect(next.layout.sectionOrder).toContain("showcases");
        expect(next.layout.sectionOrder).toContain("experience");
        expect(next.layout.hiddenSections).toEqual(["posts"]);
    });
});
