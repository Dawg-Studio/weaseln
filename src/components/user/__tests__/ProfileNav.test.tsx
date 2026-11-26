import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileNav from "../ProfileNav";
import { PROFILE_TABS } from "../sections";

describe("ProfileNav", () => {
    it("links each tab to its route", () => {
        render(
            <ProfileNav userId="alice" active="posts" tabs={PROFILE_TABS} />,
        );
        expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute(
            "href",
            "/alice",
        );
        expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
            "href",
            "/alice/projects",
        );
        expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
            "href",
            "/alice/resume",
        );
    });

    it("marks the active tab with aria-current", () => {
        render(
            <ProfileNav userId="alice" active="projects" tabs={PROFILE_TABS} />,
        );
        expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByRole("link", { name: "Posts" })).not.toHaveAttribute(
            "aria-current",
        );
    });

    it("does not render a hidden tab", () => {
        render(<ProfileNav userId="alice" active="posts" tabs={["posts"]} />);
        expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Resume" })).toBeNull();
    });
});
