import { describe, expect, it } from "vitest";

import { matchesRedirectUri } from "./redirect-uri";

describe("redirect uri matching", () => {
    it("matches an identical URI", () => {
        expect(
            matchesRedirectUri(
                ["https://app.example.com/callback"],
                "https://app.example.com/callback",
            ),
        ).toBe(true);
    });

    it("matches a loopback URI with a different port", () => {
        expect(
            matchesRedirectUri(
                ["http://127.0.0.1:19876/callback"],
                "http://127.0.0.1:41234/callback",
            ),
        ).toBe(true);
    });

    it("rejects a loopback URI with a different path", () => {
        expect(
            matchesRedirectUri(
                ["http://127.0.0.1:19876/callback"],
                "http://127.0.0.1:41234/evil",
            ),
        ).toBe(false);
    });

    it("rejects a different host", () => {
        expect(
            matchesRedirectUri(
                ["https://app.example.com/callback"],
                "https://other.example.com/callback",
            ),
        ).toBe(false);
    });

    it("rejects a prefix of a registered URI", () => {
        expect(
            matchesRedirectUri(
                ["https://app.example.com/cb"],
                "https://app.example.com/cb/evil",
            ),
        ).toBe(false);
    });

    it("rejects a URI that is not registered at all", () => {
        expect(
            matchesRedirectUri([], "https://app.example.com/callback"),
        ).toBe(false);
    });
});
