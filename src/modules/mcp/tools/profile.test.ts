import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOwnProfile, updateOwnProfile } from "@/modules/profile/service";

import {
    handleGetProfile,
    handleUpdateProfile,
    profileUpdateSchema,
} from "./profile";

vi.mock("@/modules/profile/service", () => ({
    getOwnProfile: vi.fn(),
    updateOwnProfile: vi.fn(),
}));

const profile = {
    username: "alice",
    name: "Alice",
    bio: "Builds things",
    address: "Berlin",
    occupation: "Engineer",
    email: "alice@test.com",
    image: "https://res.cloudinary.com/demo/image/upload/a.png",
    skills: ["TypeScript"],
    socials: [{ name: "GitHub", url: "https://github.com/alice" }],
};

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["profile:read", "profile:write"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("profile tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getOwnProfile).mockResolvedValue(profile);
        vi.mocked(updateOwnProfile).mockResolvedValue(profile);
    });

    it("reads the profile of the caller", async () => {
        const result = await handleGetProfile({}, context);

        expect(getOwnProfile).toHaveBeenCalledWith({ userId: "alice" });
        expect(JSON.parse(result.content[0].text).data.username).toBe("alice");
    });

    it("keeps the resume link out of the profile", async () => {
        const result = await handleGetProfile({}, context);

        expect(result.content[0].text).not.toContain("downloadUrl");
        expect(result.content[0].text).not.toContain("resumeUrl");
    });

    it("writes only the fields the caller named", async () => {
        await handleUpdateProfile({ name: "Alice" }, context);

        expect(updateOwnProfile).toHaveBeenCalledWith(
            { userId: "alice" },
            { name: "Alice" },
        );
    });

    it("reports a caller error as it is", async () => {
        // The service throws a ProfileError, which carries a 400.
        vi.mocked(updateOwnProfile).mockRejectedValue(
            Object.assign(new Error("Unsupported field: skills"), {
                status: 400,
            }),
        );

        const result = await handleUpdateProfile({ name: "Alice" }, context);

        expect(result.content[0].text).toBe("Unsupported field: skills");
        expect(result.isError).toBe(true);
    });

    it("reports an internal failure without its detail", async () => {
        vi.mocked(getOwnProfile).mockRejectedValue(
            new Error("Invalid `prisma.user.findUnique()` invocation"),
        );

        const result = await handleGetProfile({}, context);

        expect(result.content[0].text).toBe("Internal server error");
    });

    it("refuses a field outside the allowlist", () => {
        expect(profileUpdateSchema.safeParse({ skills: [] }).success).toBe(
            false,
        );
        expect(profileUpdateSchema.safeParse({ name: "Alice" }).success).toBe(
            true,
        );
    });

    it("refuses null for the column that cannot be null", () => {
        // `User.image` is a required column, so a null here would reach Prisma
        // and come back as an internal failure for a call the schema allowed.
        expect(profileUpdateSchema.safeParse({ image: null }).success).toBe(
            false,
        );
        expect(
            profileUpdateSchema.safeParse({ image: "https://img" }).success,
        ).toBe(true);
    });
});
