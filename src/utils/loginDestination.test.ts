import { afterEach, describe, expect, it, vi } from "vitest";
import { loginDestination } from "./loginDestination";

const ORIGIN = "https://weaseln.blog";

describe("loginDestination", () => {
    afterEach(() => vi.unstubAllEnvs());

    const withOrigin = () => vi.stubEnv("NEXTAUTH_URL", ORIGIN);

    it("passes ordinary destinations through untouched", () => {
        withOrigin();
        expect(loginDestination("/feed")).toBe("/feed");
        expect(loginDestination("/feed?tab=new")).toBe("/feed?tab=new");
        expect(loginDestination("/alice/welcome-to-weaseln#top")).toBe(
            "/alice/welcome-to-weaseln#top",
        );
    });

    it("still refuses to leave the origin", () => {
        withOrigin();
        expect(loginDestination("https://evil.com/x")).toBe("/");
        expect(loginDestination(undefined)).toBe("/");
    });

    /* The bounce this file exists for: sending a signed-in reader back to the
       page they are already on, which at best wastes a hop and at worst — once
       nested — exhausts the browser's redirect budget. */
    it.each([
        ["bare", "/login"],
        ["trailing slash", "/login/"],
        ["with a query", "/login?foo=bar"],
        ["with a hash", "/login#top"],
        ["nested callback", "/login?callbackUrl=%2Flogin"],
        ["absolute same-origin", `${ORIGIN}/login`],
        ["protocol-relative same-origin", "//weaseln.blog/login"],
        ["dot traversal", "/a/../login"],
        ["the verify dead end", "/login/verify"],
        ["verify with a query", "/login/verify?provider=nodemailer"],
    ])("sends %s back to the site root instead", (_name, vector) => {
        withOrigin();
        expect(loginDestination(vector)).toBe("/");
    });

    /* The prefix test has to be "/login/", not "/login" — an unrelated route
       that merely starts with those letters is a legitimate destination. */
    it("leaves routes that merely share the prefix alone", () => {
        withOrigin();
        expect(loginDestination("/loginhelp")).toBe("/loginhelp");
        expect(loginDestination("/login-help")).toBe("/login-help");
    });
});
