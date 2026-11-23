export const SHOWCASE_LAYOUTS = ["grid", "gallery", "list", "timeline"] as const;
export type ShowcaseLayout = (typeof SHOWCASE_LAYOUTS)[number];

export const EXPERIENCE_KINDS = ["work", "education"] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

export const MAX_GALLERY_IMAGES = 12;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ShowcaseInput = {
    title: string;
    description: string | null;
    layout: ShowcaseLayout;
};

export type ItemInput = {
    title: string;
    summary: string | null;
    description: string | null;
    coverImage: string | null;
    gallery: string[];
    link: string | null;
    tags: string[];
    date: string | null;
};

export type ExperienceInput = {
    kind: ExperienceKind;
    org: string;
    role: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    description: string | null;
};

export type ResumeLink = { label: string; url: string };

export type ResumeProposal = {
    headline: string | null;
    summary: string | null;
    location: string | null;
    links: ResumeLink[];
    skills: string[];
    experience: ExperienceInput[];
};

export type ResumeFacts = Omit<ResumeProposal, "experience">;
