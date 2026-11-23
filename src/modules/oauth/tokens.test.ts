import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    getOAuthSigningKey,
    signAccessToken,
    verifyAccessToken,
} from "./tokens";

const claims = {
    userId: "alice",
    clientId: "client-1",
    scopes: ["posts:read"],
    audience: "https://weaseln.example.com/api/mcp",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

describe("access tokens", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        vi.stubEnv("AUTH_SECRET", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("signs and verifies an access token", () => {
        const token = signAccessToken(claims);

        const verified = verifyAccessToken(token);

        expect(verified?.userId).toBe("alice");
        expect(verified?.clientId).toBe("client-1");
        expect(verified?.scopes).toEqual(["posts:read"]);
        expect(verified?.audience).toBe("https://weaseln.example.com/api/mcp");
        expect(verified?.expiresAt).toBe(claims.expiresAt);
    });

    it("rejects a token signed with another key", () => {
        const token = signAccessToken(claims);
        vi.stubEnv("NEXTAUTH_SECRET", "another-secret");

        expect(verifyAccessToken(token)).toBeNull();
    });

    it("rejects an expired token", () => {
        const token = signAccessToken({
            ...claims,
            expiresAt: Math.floor(Date.now() / 1000) - 10,
        });

        expect(verifyAccessToken(token)).toBeNull();
    });

    it("returns the audience as given so the verifier can compare it", () => {
        const token = signAccessToken({
            ...claims,
            audience: "https://other.example.com/api/mcp",
        });

        expect(verifyAccessToken(token)?.audience).toBe(
            "https://other.example.com/api/mcp",
        );
    });

    it("throws when no signing secret is configured", () => {
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("AUTH_SECRET", "");

        expect(() => getOAuthSigningKey()).toThrow(/NEXTAUTH_SECRET/);
        expect(() => getOAuthSigningKey()).toThrow(/AUTH_SECRET/);
    });

    it("rejects a token that is not a JWT", () => {
        expect(verifyAccessToken("not-a-token")).toBeNull();
    });
});
