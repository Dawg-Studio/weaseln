import { describe, expect, it } from "vitest";
import {
    validateExperienceInput,
    validateItemInput,
    validateResumeProposal,
    validateShowcaseInput,
} from "./validation";
import { MAX_GALLERY_IMAGES } from "./types";

const gallery = (n: number) =>
    Array.from({ length: n }, (_, i) => `https://res.cloudinary.com/leindfraust/image/upload/v1/p/${i}.jpg`);

const baseItem = {
    title: "Harbour at dusk",
    summary: null,
    description: null,
    coverImage: null,
    gallery: [],
    link: null,
    tags: [],
    date: null,
};

describe("portfolio validation", () => {
    it("rejects an unknown layout", () => {
        expect(() => validateShowcaseInput({ title: "Work", layout: "masonry" })).toThrow(/layout/);
    });

    it("accepts each of the four layouts", () => {
        for (const layout of ["grid", "gallery", "list", "timeline"]) {
            expect(validateShowcaseInput({ title: "Work", layout }).layout).toBe(layout);
        }
    });

    it("rejects the 13th gallery image", () => {
        expect(() => validateItemInput({ ...baseItem, gallery: gallery(MAX_GALLERY_IMAGES) })).not.toThrow();
        expect(() => validateItemInput({ ...baseItem, gallery: gallery(MAX_GALLERY_IMAGES + 1) })).toThrow(/12/);
    });

    it("refuses a gallery URL outside the Cloudinary allowlist", () => {
        expect(() =>
            validateItemInput({ ...baseItem, gallery: ['https://res.cloudinary.com/x/a".png'] }),
        ).toThrow(/cloudinary/i);
        expect(() => validateItemInput({ ...baseItem, gallery: ["https://evil.example/a.png"] })).toThrow(/cloudinary/i);
    });

    it("refuses a javascript: link and accepts https", () => {
        expect(() => validateItemInput({ ...baseItem, link: "javascript:alert(1)" })).toThrow(/link/);
        expect(validateItemInput({ ...baseItem, link: "https://example.com" }).link).toBe("https://example.com");
    });

    it("rejects isCurrent with an endDate and a malformed date", () => {
        const base = { kind: "work", org: "Acme", role: "Engineer", isCurrent: false };
        expect(() => validateExperienceInput({ ...base, startDate: "2024-03", endDate: "May 2025" })).toThrow(/date/i);
        expect(() => validateExperienceInput({ ...base, startDate: "2024-03", endDate: "2025-01", isCurrent: true })).toThrow(/isCurrent/);
        expect(validateExperienceInput({ ...base, startDate: "2024" }).startDate).toBe("2024");
    });

    it("rejects a proposal whose experience is not an array", () => {
        const proposal = { headline: null, summary: null, location: null, links: [], skills: [], experience: {} };
        expect(() => validateResumeProposal(proposal)).toThrow(/experience/);
    });
});
