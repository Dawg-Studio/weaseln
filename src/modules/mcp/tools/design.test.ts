import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadImage } from "@/modules/images/service";
import {
    getProfileCustomization,
    setProfileCustomization,
} from "@/modules/profile-customization/service";
import { DEFAULT_PROFILE_CUSTOMIZATION } from "@/modules/profile-customization/validation";
import { getPost, setPostCustomization } from "@/modules/posts/service";

import {
    handleGetProfileDesign,
    handleResetProfileDesign,
    handleSetPostDesign,
    handleSetProfileDesign,
    handleUploadImage,
    uploadImageScopeChallenge,
} from "./design";

vi.mock("@/modules/images/service", () => ({
    uploadImage: vi.fn(),
}));
vi.mock("@/modules/profile-customization/service", () => ({
    getProfileCustomization: vi.fn(),
    setProfileCustomization: vi.fn(),
}));
vi.mock("@/modules/posts/service", () => ({
    getPost: vi.fn(),
    setPostCustomization: vi.fn(),
}));

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["design:read", "design:write"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("design tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: { type: "doc", content: [] },
            published: true,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });
        vi.mocked(setProfileCustomization).mockResolvedValue({
            preset: "editorial",
        } as never);
        vi.mocked(uploadImage).mockResolvedValue({
            url: "https://res.cloudinary.com/demo/image/upload/x.jpg",
        });
    });

    it("merges a partial profile design over the stored one", async () => {
        await handleSetProfileDesign({ preset: "editorial" }, context);

        expect(setProfileCustomization).toHaveBeenCalledWith(
            { userId: "alice" },
            { preset: "editorial" },
        );
    });

    it("rejects a background colour outside the palette", async () => {
        const result = await handleSetPostDesign(
            { postId: "post-1", backgroundColor: "#ff0000" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(setPostCustomization).not.toHaveBeenCalled();
    });

    it("rejects a background image URL outside the allowlist", async () => {
        const result = await handleSetPostDesign(
            { postId: "post-1", backgroundImage: "https://evil.example.com/x.png" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(setPostCustomization).not.toHaveBeenCalled();
    });

    it("writes a background that passes both checks", async () => {
        await handleSetPostDesign(
            {
                postId: "post-1",
                backgroundColor: "moss",
                backgroundImage: "/covers/cover-1.svg",
            },
            context,
        );

        expect(setPostCustomization).toHaveBeenCalledTimes(1);
    });

    it("uploads an image and returns its URL", async () => {
        const result = await handleUploadImage(
            { data: "AAAA", purpose: "cover" },
            context,
        );

        expect(uploadImage).toHaveBeenCalledTimes(1);
        expect(result.content[0].text).toContain(
            "https://res.cloudinary.com/demo/image/upload/x.jpg",
        );
    });

    it("accepts an upload with posts:write, org:write or design:write", () => {
        for (const scope of ["posts:write", "org:write", "design:write"]) {
            const challenge = uploadImageScopeChallenge({
                request: { params: {} },
                authInfo: { scopes: [scope] } as never,
            });
            expect(challenge).toBeUndefined();
        }
        const refused = uploadImageScopeChallenge({
            request: { params: {} },
            authInfo: { scopes: ["posts:read"] } as never,
        });
        expect(refused?.scopes).toEqual([
            "posts:write",
            "org:write",
            "design:write",
        ]);
    });

    it("resets the profile design to the defaults", async () => {
        await handleResetProfileDesign({}, context);

        expect(setProfileCustomization).toHaveBeenCalledWith(
            { userId: "alice" },
            DEFAULT_PROFILE_CUSTOMIZATION,
        );
    });

    it("reads the profile design of this account", async () => {
        vi.mocked(getProfileCustomization).mockResolvedValue({
            preset: "minimal",
        } as never);

        const result = await handleGetProfileDesign({}, context);

        expect(result.content[0].text).toContain("minimal");
    });
});
