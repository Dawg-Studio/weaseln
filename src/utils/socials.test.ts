import { describe, expect, it } from "vitest";
import { mergeSocialsByName } from "./socials";

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
