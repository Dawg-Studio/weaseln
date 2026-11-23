import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAccessToken } from "@/modules/oauth/tokens";

import { verifyMcpAccessToken } from "./verifier";

const claims = {
    userId: "alice",
    clientId: "client-1",
    scopes: ["posts:read", "posts:write"],
    audience: "https://weaseln.example.com/api/mcp",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

describe("mcp access token verifier", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        vi.stubEnv("AUTH_SECRET", "");
    });

    it("returns the caller's user, client and scopes", async () => {
        const auth = await verifyMcpAccessToken(signAccessToken(claims));

        expect(auth.clientId).toBe("client-1");
        expect(auth.scopes).toEqual(["posts:read", "posts:write"]);
        expect(auth.expiresAt).toBe(claims.expiresAt);
        expect(auth.resource).toBeInstanceOf(URL);
        expect(auth.resource?.toString()).toBe(claims.audience);
        expect(auth.extra?.userId).toBe("alice");
    });

    it("rejects a token with no signing secret configured", async () => {
        const token = signAccessToken(claims);
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("AUTH_SECRET", "");

        await expect(verifyMcpAccessToken(token)).rejects.toMatchObject({
            code: "invalid_token",
        });
    });

    it("reports the audience as the resource so the gate can refuse another one", async () => {
        const auth = await verifyMcpAccessToken(
            signAccessToken({
                ...claims,
                audience: "https://other.example.com/api/mcp",
            }),
        );

        expect(auth.resource?.toString()).toBe(
            "https://other.example.com/api/mcp",
        );
    });

    it("rejects a token that is not a JWT", async () => {
        await expect(verifyMcpAccessToken("not-a-token")).rejects.toThrow(
            "Invalid access token",
        );
    });
});
