import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAccessToken } from "@/modules/oauth/tokens";

import { POST } from "./route";

const ORIGIN = "http://localhost";

function mcpRequest(body: unknown, token?: string) {
    return new Request(`${ORIGIN}/api/mcp`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
}

const toolsList = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
};

function tokenFor(audience = `${ORIGIN}/api/mcp`) {
    return signAccessToken({
        userId: "alice",
        clientId: "client-1",
        scopes: ["posts:read"],
        audience,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
}

describe("POST /api/mcp", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
        vi.stubEnv("AUTH_SECRET", "");
    });

    it("answers 401 with a challenge when the request has no token", async () => {
        const res = await POST(mcpRequest(toolsList));

        expect(res.status).toBe(401);
        expect(res.headers.get("www-authenticate")).toContain(
            "oauth-protected-resource",
        );
    });

    it("answers a tools list for a valid token", async () => {
        const res = await POST(mcpRequest(toolsList, tokenFor()));

        expect(res.status, await res.clone().text()).toBe(200);
    });

    it("answers 401 for a token minted for another resource", async () => {
        const res = await POST(
            mcpRequest(toolsList, tokenFor("https://other.example.com/api/mcp")),
        );

        expect(res.status).toBe(401);
    });

    it("registers all sixteen tools", async () => {
        const res = await POST(mcpRequest(toolsList, tokenFor()));

        const body = await res.text();
        for (const name of [
            "whoami",
            "list_posts",
            "get_post",
            "create_post",
            "update_post",
            "delete_post",
            "list_orgs",
            "get_org",
            "create_org",
            "update_org",
            "update_org_member",
            "get_profile_design",
            "set_profile_design",
            "reset_profile_design",
            "set_post_design",
            "upload_image",
        ]) {
            expect(body).toContain(name);
        }
    });

    it("takes a body that holds a full size resume", async () => {
        const cursor = "x".repeat(6 * 1024 * 1024);

        const res = await POST(
            mcpRequest({ ...toolsList, params: { cursor } }, tokenFor()),
        );

        expect(res.status, await res.clone().text()).toBe(200);
    });

    it("refuses a body above the cap", async () => {
        const cursor = "x".repeat(9 * 1024 * 1024);

        const res = await POST(
            mcpRequest({ ...toolsList, params: { cursor } }, tokenFor()),
        );

        expect(res.status).toBe(413);
    });
});
