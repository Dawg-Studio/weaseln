import type { ProfileSection } from "@/modules/profile-customization/types";

/**
 * The sections `UserOrgProfile` actually renders. It is hand-maintained rather
 * than derived from `PROFILE_SECTIONS`, so the coverage test in
 * __tests__/sections.test.ts can catch a section id that has no renderer (the
 * renderers map is a `Record<string, …>` and would compile without one).
 */
export const RENDERED_SECTIONS = [
    "hero",
    "stats",
    "about",
    "experience",
    "showcases",
    "socials",
    "featuredPost",
    "interests",
    "organizations",
    "resume",
    "posts",
] as const satisfies readonly ProfileSection[];

export type RenderedSection = (typeof RENDERED_SECTIONS)[number];

export const PROFILE_TABS = ["posts", "projects", "resume"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** The sections each tab renders, in the order they render. */
export const TAB_SECTIONS: Record<ProfileTab, readonly ProfileSection[]> = {
    posts: ["featuredPost", "posts"],
    projects: ["showcases"],
    resume: ["experience", "resume"],
};

/** The sections that live in the facts column beside the tab content. */
export const FACTS_SECTIONS: readonly ProfileSection[] = [
    "stats",
    "socials",
    "organizations",
];

/**
 * The sections a tab renders whatever the owner hid: the feed is the landing
 * view, and the showcase blocks are public on their own page whatever the
 * navigation shows.
 */
const ALWAYS_RENDERED: readonly ProfileSection[] = ["posts", "showcases"];

/**
 * The sections a tab renders. The feed and the showcase blocks are the tabs
 * themselves, so they render whatever the owner hid; every other section
 * follows its own flag.
 */
export function sectionsForTab(
    tab: ProfileTab,
    visibleSections: readonly ProfileSection[],
): ProfileSection[] {
    return TAB_SECTIONS[tab].filter(
        (section) =>
            ALWAYS_RENDERED.includes(section) ||
            visibleSections.includes(section),
    );
}

/**
 * The tabs a reader sees. The posts tab is always there - it is the landing
 * view - and every other tab lives as long as one of its sections is visible,
 * so hiding one half of the resume never strands the other half.
 */
export function visibleTabs(
    hiddenSections: readonly ProfileSection[],
): ProfileTab[] {
    const hidden = new Set(hiddenSections);
    return PROFILE_TABS.filter((tab) => {
        if (tab === "posts") return true;
        return TAB_SECTIONS[tab].some((section) => !hidden.has(section));
    });
}
