import { describe, expect, it } from "vitest";

import { s256, verifyPkceChallenge } from "./pkce";

describe("pkce", () => {
    it("accepts a matching S256 verifier", () => {
        expect(
            verifyPkceChallenge({
                challenge: s256("verifier"),
                method: "S256",
                verifier: "verifier",
            }),
        ).toBe(true);
    });

    it("rejects the plain method", () => {
        expect(
            verifyPkceChallenge({
                challenge: "verifier",
                method: "plain",
                verifier: "verifier",
            }),
        ).toBe(false);
    });

    it("rejects a wrong verifier", () => {
        expect(
            verifyPkceChallenge({
                challenge: s256("verifier"),
                method: "S256",
                verifier: "another-verifier",
            }),
        ).toBe(false);
    });
});
