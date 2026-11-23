import { describe, expect, it } from "vitest";
import { mergeProfileSocials } from "./socials";

describe("mergeProfileSocials", () => {
    it("keeps a social the profile form does not know about", () => {
        const merged = mergeProfileSocials(
            [{ name: "Facebook", url: "https://facebook.com/alice" }, { name: "GitHub", url: "https://github.com/alice" }],
            [{ name: "Facebook", url: "https://facebook.com/alice" }],
        );
        expect(merged.map((entry) => entry.name)).toEqual(["Facebook", "GitHub"]);
    });

    it("replaces the fields the form owns", () => {
        const merged = mergeProfileSocials(
            [{ name: "Twitter", url: "https://old" }],
            [{ name: "Twitter", url: "https://new" }],
        );
        expect(merged).toEqual([{ name: "Twitter", url: "https://new" }]);
    });

    it("survives a null socials column", () => {
        expect(mergeProfileSocials(null, [{ name: "Facebook", url: "" }])).toEqual([
            { name: "Facebook", url: "" },
        ]);
    });
});
