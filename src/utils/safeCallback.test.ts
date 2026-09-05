import { afterEach, describe, expect, it, vi } from "vitest";
import { safeCallback } from "./safeCallback";

const ORIGIN = "https://weaseln.blog";

// A single backslash, built without escapes — the escaping is the whole point of
// these cases, so it should not depend on reading a "\\" correctly in review.
const BS = String.fromCharCode(92);

/* What a browser does with a Location value is exactly WHATWG URL resolution, so
   resolving the *output* against our origin is the honest assertion: did the
   reader stay on weaseln, whatever the sanitiser chose to return? */
const landsOn = (loc: string) => new URL(loc, ORIGIN).origin;

describe("safeCallback", () => {
    afterEach(() => vi.unstubAllEnvs());

    const withOrigin = () => {
        vi.stubEnv("AUTH_URL", ORIGIN);
        vi.stubEnv("NEXTAUTH_URL", undefined);
    };

    it("keeps ordinary same-site paths", () => {
        withOrigin();
        expect(safeCallback("/feed")).toBe("/feed");
        expect(safeCallback("/feed?tab=new")).toBe("/feed?tab=new");
        expect(safeCallback("/feed#top")).toBe("/feed#top");
    });

    it("reduces an absolute same-origin URL to its path", () => {
        withOrigin();
        expect(safeCallback(`${ORIGIN}/feed?x=1`)).toBe("/feed?x=1");
    });

    it("prefers AUTH_URL over the legacy NEXTAUTH_URL", () => {
        vi.stubEnv("AUTH_URL", ORIGIN);
        vi.stubEnv("NEXTAUTH_URL", "https://legacy.example");
        expect(safeCallback(`${ORIGIN}/feed`)).toBe("/feed");
        expect(safeCallback("https://legacy.example/feed")).toBe("/");
    });

    it.each([
        ["missing", undefined],
        ["empty", ""],
    ])("falls back to NEXTAUTH_URL when AUTH_URL is %s", (_case, authUrl) => {
        vi.stubEnv("AUTH_URL", authUrl);
        vi.stubEnv("NEXTAUTH_URL", ORIGIN);
        expect(safeCallback(`${ORIGIN}/feed`)).toBe("/feed");
    });

    it("fails closed when the preferred configured URL is malformed", () => {
        vi.stubEnv("AUTH_URL", "https://[");
        vi.stubEnv("NEXTAUTH_URL", ORIGIN);
        expect(safeCallback("/feed")).toBe("/");
    });

    it("fails closed when the legacy configured URL is malformed", () => {
        vi.stubEnv("AUTH_URL", undefined);
        vi.stubEnv("NEXTAUTH_URL", "https://[");
        expect(safeCallback("/feed")).toBe("/");
    });

    it("defaults to / when there is no callback", () => {
        withOrigin();
        expect(safeCallback(undefined)).toBe("/");
        expect(safeCallback("")).toBe("/");
    });

    /* The regression this file exists for. "/\evil.com" passed the old
       startsWith("/") && !startsWith("//") guard, and browsers then normalised
       the backslash into the protocol-relative "//evil.com". */
    it.each([
        ["protocol-relative", "//evil.com"],
        ["leading backslash", `/${BS}evil.com`],
        ["backslash then slash", `/${BS}/evil.com`],
        ["slashes then backslash", `//${BS}evil.com`],
        ["double backslash", `${BS}${BS}evil.com`],
        ["backslash slash", `${BS}/evil.com`],
        ["triple slash", "///evil.com"],
        ["absolute cross-origin", "https://evil.com/x"],
        ["same-origin absolute with a double-slash path", `${ORIGIN}//evil.com`],
        ["userinfo trick", "https://weaseln.blog@evil.com/"],
        ["scheme case", "HtTpS://evil.com"],
        ["javascript scheme", "javascript:alert(1)"],
        ["backslash after scheme", `http:/${BS}evil.com`],
    ])("refuses to leave the origin: %s", (_name, vector) => {
        withOrigin();
        expect(landsOn(safeCallback(vector))).toBe(ORIGIN);
    });

    it("strips raw CR/LF/tab out of the redirect value", () => {
        withOrigin();
        for (const ch of ["\r", "\n", "\t"]) {
            const out = safeCallback(`/${ch}evil.com`);
            expect(out).not.toContain(ch);
            expect(landsOn(out)).toBe(ORIGIN);
        }
    });

    it("normalises dot traversal", () => {
        withOrigin();
        expect(safeCallback("/a/../b")).toBe("/b");
    });

    it("still accepts relative paths when both configured URLs are unset", () => {
        vi.stubEnv("AUTH_URL", undefined);
        vi.stubEnv("NEXTAUTH_URL", undefined);
        expect(safeCallback("/feed")).toBe("/feed");
        expect(safeCallback("http://localhost:3000/feed")).toBe("/feed");
        // ...and an absolute URL to some other host is still refused.
        expect(safeCallback("https://evil.com/x")).toBe("/");
    });
});
