import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_LAYOUT, validateProfileCustomizationInput } from "./validation";

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
});