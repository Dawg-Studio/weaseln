import { describe, expect, it, vi } from "vitest";
import {
    DEFAULT_PROFILE_CUSTOMIZATION,
    DEFAULT_PROFILE_LAYOUT,
    normalizeProfileCustomization,
    validateProfileCustomizationInput,
} from "./validation";

describe("profile customization validation", () => {
    it("uses the approved default section order", () => {
        expect(DEFAULT_PROFILE_LAYOUT.sectionOrder).toEqual([
            "hero", "stats", "about", "socials", "featuredPost",
            "interests", "organizations", "posts",
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