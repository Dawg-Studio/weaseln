import { beforeEach, describe, expect, it, vi } from "vitest";

import { listOrganizations } from "@/modules/organization/service";

import { handleWhoami } from "./identity";

vi.mock("@/modules/organization/service", () => ({
    listOrganizations: vi.fn(),
}));

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["posts:read"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("identity tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(listOrganizations).mockResolvedValue([]);
    });

    it("reports the caller from the token, not from the arguments", async () => {
        const result = await handleWhoami({ userId: "bob" }, context);

        expect(result.content[0].text).toContain('"userId": "alice"');
        expect(result.content[0].text).not.toContain('"userId": "bob"');
        expect(listOrganizations).toHaveBeenCalledWith({ userId: "alice" });
    });
});
