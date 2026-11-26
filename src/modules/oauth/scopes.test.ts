import { describe, expect, it } from "vitest";

import { OAUTH_SCOPES, grantedScopes } from "./scopes";

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

describe("grantedScopes", () => {
    it("grants every known scope to a public client that asks for nothing", () => {
        expect(grantedScopes([], { public: true })).toEqual([...OAUTH_SCOPES]);
    });

    it("keeps an empty grant for a registered client that asks for nothing", () => {
        expect(grantedScopes([], { public: false })).toEqual([]);
    });

    it("grants a public client exactly what it asked for", () => {
        expect(grantedScopes(["posts:read"], { public: true })).toEqual([
            "posts:read",
        ]);
    });
});
