import { expect, it } from "vitest";
import { PROFILE_SECTIONS } from "@/modules/profile-customization/types";
import {
    PROFILE_TABS,
    RENDERED_SECTIONS,
    TAB_SECTIONS,
    visibleTabs,
} from "../sections";

it("has a renderer for every profile section", () => {
    expect([...RENDERED_SECTIONS].sort()).toEqual([...PROFILE_SECTIONS].sort());
});

it("always shows the posts tab, even when posts is hidden", () => {
    expect(visibleTabs(["posts"])).toEqual(["posts", "projects", "resume"]);
});

it("drops the projects tab when the showcases are hidden", () => {
    expect(visibleTabs(["showcases"])).toEqual(["posts", "resume"]);
});

it("keeps the resume tab when only one of its two sections is hidden", () => {
    expect(visibleTabs(["experience"])).toEqual([
        "posts",
        "projects",
        "resume",
    ]);
    expect(visibleTabs(["resume"])).toEqual(["posts", "projects", "resume"]);
});

it("drops the resume tab only when both of its sections are hidden", () => {
    expect(visibleTabs(["experience", "resume"])).toEqual([
        "posts",
        "projects",
    ]);
});

it("maps every tab to the sections it renders", () => {
    expect(TAB_SECTIONS.posts).toEqual(["featuredPost", "posts"]);
    expect(TAB_SECTIONS.projects).toEqual(["showcases"]);
    expect(TAB_SECTIONS.resume).toEqual(["experience", "resume"]);
    expect(PROFILE_TABS).toEqual(["posts", "projects", "resume"]);
});
