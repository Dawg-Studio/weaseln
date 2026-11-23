import { describe, expect, it } from "vitest";

import { OAUTH_SCOPES } from "./scopes";

describe("oauth scopes", () => {
    it("names the profile and portfolio permissions", () => {
        expect(OAUTH_SCOPES).toEqual([
            "posts:read",
            "posts:write",
            "org:read",
            "org:write",
            "design:read",
            "design:write",
            "profile:read",
            "profile:write",
            "portfolio:read",
            "portfolio:write",
        ]);
    });
});
