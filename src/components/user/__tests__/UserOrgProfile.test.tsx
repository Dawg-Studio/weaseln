import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));
// The feed pulls react-query and fetch; the profile shell does not need it.
vi.mock("@/components/post/PostList", () => ({ default: () => null }));
vi.mock("@/components/user/actions/UserFollowButton", () => ({
    default: () => null,
}));

import UserOrgProfile from "../UserOrgProfile";
import type { User } from "@/generated/prisma/client";

// Only the fields the profile reads, so the fixture stays readable.
const user = {
    id: "u1",
    username: "alice",
    name: "Alice",
    image: "/alice.png",
    bio: "writes things",
    address: "Berlin",
    occupation: "Engineer",
    createdAt: new Date("2024-01-01"),
    interests: [],
    socials: [],
    skills: [],
    organizations: [],
    showcases: [],
    experience: [],
    pinned: null,
    resumeUrl: null,
    resumePublic: false,
    profileCustomization: null,
    _count: { post: 3, following: 1, followedBy: 2 },
} as unknown as User;

describe("UserOrgProfile", () => {
    it("renders the navigation on a tabbed profile", async () => {
        render(
            await UserOrgProfile({ user, userId: "alice", tab: "posts" }),
        );

        expect(
            screen.getByRole("navigation", { name: "Profile sections" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Projects" }),
        ).toHaveAttribute("href", "/alice/projects");
    });

    it("renders no navigation without a tab", async () => {
        render(await UserOrgProfile({ user, userId: "alice" }));

        expect(
            screen.queryByRole("navigation", { name: "Profile sections" }),
        ).toBeNull();
    });

    it("marks the active tab with aria-current", async () => {
        render(
            await UserOrgProfile({ user, userId: "alice", tab: "resume" }),
        );

        expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    it("says when the projects tab has nothing to show", async () => {
        render(
            await UserOrgProfile({ user, userId: "alice", tab: "projects" }),
        );

        expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    });

    it("says when the resume tab has nothing to show", async () => {
        render(
            await UserOrgProfile({ user, userId: "alice", tab: "resume" }),
        );

        expect(screen.getByText("No resume yet.")).toBeInTheDocument();
    });
});
