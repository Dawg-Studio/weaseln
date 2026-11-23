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
