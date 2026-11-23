import { describe, expect, it } from "vitest";
import { mergeSocialsByName, renderableSocials } from "./socials";

describe("mergeSocialsByName", () => {
    it("keeps a stored social the caller did not send", () => {
        const merged = mergeSocialsByName(
            [{ name: "Facebook", url: "https://fb" }],
            [{ name: "GitHub", url: "https://github.com/alice" }],
        );
        expect(merged.map((entry) => entry.name)).toEqual([
            "GitHub",
            "Facebook",
        ]);
    });

    it("replaces a stored social with the one the caller sent", () => {
        const merged = mergeSocialsByName(
            [{ name: "Facebook", url: "https://old" }],
            [{ name: "Facebook", url: "https://new" }],
        );
        expect(merged).toEqual([{ name: "Facebook", url: "https://new" }]);
    });

    it("drops a stored social the profile could not render", () => {
        const merged = mergeSocialsByName(
            [
                { name: "Facebook", url: 42 } as never,
                null as never,
                { name: "Twitter", url: "https://t" },
            ],
            [{ name: "GitHub", url: "https://g" }],
        );
        expect(merged.map((entry) => entry.name)).toEqual([
            "GitHub",
            "Twitter",
        ]);
    });

    it("survives a null column", () => {
        expect(mergeSocialsByName(null, [{ name: "Facebook", url: "" }])).toEqual([
            { name: "Facebook", url: "" },
        ]);
    });
});

describe("renderableSocials", () => {
    it("keeps only the socials whose url is a string", () => {
        const rendered = renderableSocials([
            { name: "Facebook", url: "https://fb" },
            { name: "Broken", url: 42 } as never,
            null as never,
            { name: "NoUrl" } as never,
        ]);
        expect(rendered.map((entry) => entry.name)).toEqual(["Facebook"]);
    });

    it("returns nothing for a column that is not a list", () => {
        expect(renderableSocials(null)).toEqual([]);
        expect(renderableSocials(undefined)).toEqual([]);
    });
});
