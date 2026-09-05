import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInUrl } from "./signInUrl";

describe("signInUrl", () => {
    beforeEach(() => {
        vi.stubEnv("AUTH_URL", "https://weaseln.blog");
        vi.stubEnv("NEXTAUTH_URL", undefined);
    });

    afterEach(() => vi.unstubAllEnvs());

    it.each([
        ["/new", "/api/auth/signin?callbackUrl=%2Fnew"],
        [
            "/settings/profile",
            "/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile",
        ],
        [
            "/manage/posts?status=draft",
            "/api/auth/signin?callbackUrl=%2Fmanage%2Fposts%3Fstatus%3Ddraft",
        ],
    ])("encodes the protected destination %s", (callbackUrl, expected) => {
        expect(signInUrl(callbackUrl)).toBe(expected);
    });

    it.each([
        "//evil.com",
        "https://evil.com/feed",
        "https://weaseln.blog//evil.com",
    ])("falls back to the root for an unsafe callback: %s", (callbackUrl) => {
        expect(signInUrl(callbackUrl)).toBe(
            "/api/auth/signin?callbackUrl=%2F",
        );
    });
});
