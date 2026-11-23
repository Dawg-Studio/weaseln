import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
    applyResumeProposal,
    getResumeState,
    removeResume,
    setResumeVisibility,
    uploadResume,
} from "@/modules/portfolio/resume";
import {
    createExperience,
    createItem,
    createShowcase,
    deleteExperience,
    deleteItem,
    deleteShowcase,
    listExperience,
    listPortfolio,
    listShowcases,
    moveExperience,
    moveItem,
    moveShowcase,
    updateExperience,
    updateItem,
    updateShowcase,
} from "@/modules/portfolio/service";
import { EXPERIENCE_KINDS, SHOWCASE_LAYOUTS } from "@/modules/portfolio/types";

import { callerOf, text, toolError, type ToolContext } from "./shared";

/**
 * The proposal `upload_resume` hands back, so an agent can correct what the
 * parser got wrong and send it to `apply_resume` unchanged.
 */
const resumeProposalSchema = z.object({
    headline: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    links: z
        .array(z.object({ label: z.string(), url: z.string() }))
        .optional(),
    skills: z.array(z.string()).optional(),
    experience: z
        .array(
            z.object({
                kind: z.enum(["work", "education"]),
                org: z.string(),
                role: z.string(),
                location: z.string().nullable().optional(),
                startDate: z.string().nullable().optional(),
                endDate: z.string().nullable().optional(),
                isCurrent: z.boolean().optional(),
                description: z.string().nullable().optional(),
            }),
        )
        .optional(),
});

type ResumeProposalArgs = z.infer<typeof resumeProposalSchema>;

type UploadResumeArgs = { data: string };

type SetResumeVisibilityArgs = { isPublic: boolean };

const layoutSchema = z.enum(SHOWCASE_LAYOUTS);

const directionSchema = z.enum(["up", "down"]);

const itemSchema = z.object({
    title: z.string(),
    summary: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    gallery: z.array(z.string()).optional(),
    link: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    date: z.string().nullable().optional(),
});

const itemUpdateSchema = itemSchema.partial();

const showcaseCreateSchema = z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    layout: layoutSchema,
});

const showcaseUpdateSchema = z.object({
    showcaseId: z.string(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    layout: layoutSchema.optional(),
});

const experienceSchema = z.object({
    kind: z.enum(EXPERIENCE_KINDS),
    org: z.string(),
    role: z.string(),
    location: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    isCurrent: z.boolean().optional(),
    description: z.string().nullable().optional(),
});

const experienceUpdateSchema = experienceSchema
    .partial()
    .extend({ experienceId: z.string() });

type ExperienceCreateArgs = z.infer<typeof experienceSchema>;

type ExperienceUpdateArgs = z.infer<typeof experienceUpdateSchema>;

type ItemCreateArgs = z.infer<typeof itemSchema> & { showcaseId: string };

type ItemUpdateArgs = z.infer<typeof itemUpdateSchema> & { itemId: string };

type ShowcaseCreateArgs = z.infer<typeof showcaseCreateSchema>;

type ShowcaseUpdateArgs = z.infer<typeof showcaseUpdateSchema>;

type MoveArgs = { direction: "up" | "down" };

/** An absent key keeps the stored value; an explicit null clears the field. */
function pick<T>(value: T | undefined, stored: T): T {
    return value !== undefined ? value : stored;
}

function toDirection(direction: "up" | "down"): -1 | 1 {
    return direction === "up" ? -1 : 1;
}

export async function handleGetResume(
    _args: Record<string, never>,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const state = await getResumeState({ userId: caller.userId });
        return text({ data: state });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUploadResume(
    args: UploadResumeArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const bytes = new Uint8Array(Buffer.from(args.data, "base64"));
        const result = await uploadResume(
            { userId: caller.userId },
            { bytes },
        );
        // The whole result travels: a PDF that was stored but not parsed is a
        // success with a null proposal and the parser's complaint, and the
        // agent has to know the file landed.
        return text({ data: result });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleApplyResume(
    args: ResumeProposalArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        // The facts go through untouched: a null field means the resume did
        // not state it, and the service leaves the stored value alone.
        const result = await applyResumeProposal(
            { userId: caller.userId },
            args,
        );
        return text({ data: result });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleSetResumeVisibility(
    args: SetResumeVisibilityArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await setResumeVisibility(
            { userId: caller.userId },
            { isPublic: args.isPublic },
        );
        return text({ data: { isPublic: args.isPublic } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleDeleteResume(
    _args: Record<string, never>,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await removeResume({ userId: caller.userId });
        return text({ data: { deleted: true } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleListPortfolio(
    _args: Record<string, never>,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const [showcases, experience] = await Promise.all([
            listPortfolio({ userId: caller.userId }),
            listExperience({ userId: caller.userId }),
        ]);
        return text({ data: { showcases, experience } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleCreateShowcase(
    args: ShowcaseCreateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const showcase = await createShowcase({ userId: caller.userId }, {
            title: args.title,
            description: args.description ?? null,
            layout: args.layout,
        });
        return text({ data: showcase });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateShowcase(
    args: ShowcaseUpdateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const showcases = await listShowcases({ userId: caller.userId });
        const stored = showcases.find((row) => row.id === args.showcaseId);
        if (!stored) throw new Error("Showcase not found");
        await updateShowcase({ userId: caller.userId }, {
            showcaseId: args.showcaseId,
            title: pick(args.title, stored.title),
            description: pick(args.description, stored.description),
            layout: pick(args.layout, stored.layout),
        });
        return text({ data: { updated: args.showcaseId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleDeleteShowcase(
    args: { showcaseId: string },
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await deleteShowcase({ userId: caller.userId }, {
            showcaseId: args.showcaseId,
        });
        return text({ data: { deleted: args.showcaseId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleMoveShowcase(
    args: { showcaseId: string } & MoveArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await moveShowcase({ userId: caller.userId }, {
            showcaseId: args.showcaseId,
            direction: toDirection(args.direction),
        });
        return text({ data: { moved: args.showcaseId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleCreateItem(
    args: ItemCreateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const item = await createItem({ userId: caller.userId }, {
            showcaseId: args.showcaseId,
            title: args.title,
            summary: args.summary ?? null,
            description: args.description ?? null,
            coverImage: args.coverImage ?? null,
            gallery: args.gallery ?? [],
            link: args.link ?? null,
            tags: args.tags ?? [],
            date: args.date ?? null,
        });
        return text({ data: item });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateItem(
    args: ItemUpdateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const showcases = await listPortfolio({ userId: caller.userId });
        const stored = showcases
            .flatMap((showcase) => showcase.items)
            .find((item) => item.id === args.itemId);
        if (!stored) throw new Error("Item not found");
        await updateItem({ userId: caller.userId }, {
            itemId: args.itemId,
            title: pick(args.title, stored.title),
            summary: pick(args.summary, stored.summary),
            description: pick(args.description, stored.description),
            coverImage: pick(args.coverImage, stored.coverImage),
            gallery: pick(args.gallery, stored.gallery),
            link: pick(args.link, stored.link),
            tags: pick(args.tags, stored.tags),
            date: pick(args.date, stored.date),
        });
        return text({ data: { updated: args.itemId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleDeleteItem(
    args: { itemId: string },
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await deleteItem({ userId: caller.userId }, { itemId: args.itemId });
        return text({ data: { deleted: args.itemId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleMoveItem(
    args: { itemId: string } & MoveArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await moveItem({ userId: caller.userId }, {
            itemId: args.itemId,
            direction: toDirection(args.direction),
        });
        return text({ data: { moved: args.itemId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleCreateExperience(
    args: ExperienceCreateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const entry = await createExperience({ userId: caller.userId }, {
            kind: args.kind,
            org: args.org,
            role: args.role,
            location: args.location ?? null,
            startDate: args.startDate ?? null,
            endDate: args.endDate ?? null,
            isCurrent: args.isCurrent ?? false,
            description: args.description ?? null,
        });
        return text({ data: entry });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateExperience(
    args: ExperienceUpdateArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const rows = await listExperience({ userId: caller.userId });
        const stored = rows.find((row) => row.id === args.experienceId);
        if (!stored) throw new Error("Experience not found");
        await updateExperience({ userId: caller.userId }, {
            experienceId: args.experienceId,
            kind: pick(args.kind, stored.kind),
            org: pick(args.org, stored.org),
            role: pick(args.role, stored.role),
            location: pick(args.location, stored.location),
            startDate: pick(args.startDate, stored.startDate),
            endDate: pick(args.endDate, stored.endDate),
            isCurrent: pick(args.isCurrent, stored.isCurrent),
            description: pick(args.description, stored.description),
        });
        return text({ data: { updated: args.experienceId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleDeleteExperience(
    args: { experienceId: string },
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await deleteExperience({ userId: caller.userId }, {
            experienceId: args.experienceId,
        });
        return text({ data: { deleted: args.experienceId } });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleMoveExperience(
    args: { experienceId: string } & MoveArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await moveExperience({ userId: caller.userId }, {
            experienceId: args.experienceId,
            direction: toDirection(args.direction),
        });
        return text({ data: { moved: args.experienceId } });
    } catch (error) {
        return toolError(error);
    }
}

export function registerPortfolioTools(server: McpServer) {    server.registerTool(
        "get_resume",
        {
            description:
                "Read the resume of this account: whether one is stored, whether it is public, and a download link.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("portfolio:read"),
        },
        handleGetResume,
    );

    server.registerTool(
        "upload_resume",
        {
            description:
                "Upload a resume PDF and read what it says. Nothing is written to the profile until you call apply_resume.",
            inputSchema: z.object({
                data: z
                    .string()
                    .describe(
                        "The PDF as base64, without a data URL prefix",
                    ),
            }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleUploadResume,
    );

    server.registerTool(
        "apply_resume",
        {
            description:
                "Write the resume facts you confirmed: headline, summary, location, links, skills and experience. A field you leave null keeps the stored value.",
            inputSchema: resumeProposalSchema,
            // It writes the profile text as well as the experience rows, so
            // both permissions are required.
            scopeChallenge: requireScopes("portfolio:write", "profile:write"),
        },
        handleApplyResume,
    );

    server.registerTool(
        "set_resume_visibility",
        {
            description: "Make the resume of this account public or private.",
            inputSchema: z.object({ isPublic: z.boolean() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleSetResumeVisibility,
    );

    server.registerTool(
        "delete_resume",
        {
            description:
                "Delete the resume of this account and the file behind it.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleDeleteResume,
    );

    server.registerTool(
        "list_portfolio",
        {
            description:
                "List the project showcases of this account, with the projects in each one, and the experience list.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("portfolio:read"),
        },
        handleListPortfolio,
    );

    server.registerTool(
        "create_showcase",
        {
            description: "Create a project showcase on this account.",
            inputSchema: showcaseCreateSchema,
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleCreateShowcase,
    );

    server.registerTool(
        "update_showcase",
        {
            description:
                "Change one of this account's project showcases. Leave a field out to keep it; send null to clear it.",
            inputSchema: showcaseUpdateSchema,
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleUpdateShowcase,
    );

    server.registerTool(
        "delete_showcase",
        {
            description:
                "Delete one of this account's project showcases and the projects in it.",
            inputSchema: z.object({ showcaseId: z.string() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleDeleteShowcase,
    );

    server.registerTool(
        "move_showcase",
        {
            description:
                "Move one of this account's project showcases up or down.",
            inputSchema: z.object({
                showcaseId: z.string(),
                direction: directionSchema,
            }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleMoveShowcase,
    );

    server.registerTool(
        "create_item",
        {
            description: "Add a project to one of this account's showcases.",
            inputSchema: itemSchema.extend({ showcaseId: z.string() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleCreateItem,
    );

    server.registerTool(
        "update_item",
        {
            description:
                "Change one of this account's projects. Leave a field out to keep it; send null to clear it.",
            inputSchema: itemUpdateSchema.extend({ itemId: z.string() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleUpdateItem,
    );

    server.registerTool(
        "delete_item",
        {
            description: "Delete one of this account's projects.",
            inputSchema: z.object({ itemId: z.string() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleDeleteItem,
    );

    server.registerTool(
        "move_item",
        {
            description: "Move one of this account's projects up or down.",
            inputSchema: z.object({
                itemId: z.string(),
                direction: directionSchema,
            }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleMoveItem,
    );

    server.registerTool(
        "create_experience",
        {
            description:
                "Add a work or education entry to this account's experience list.",
            inputSchema: experienceSchema,
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleCreateExperience,
    );

    server.registerTool(
        "update_experience",
        {
            description:
                "Change one of this account's experience entries. Leave a field out to keep it; send null to clear it.",
            inputSchema: experienceUpdateSchema,
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleUpdateExperience,
    );

    server.registerTool(
        "delete_experience",
        {
            description: "Delete one of this account's experience entries.",
            inputSchema: z.object({ experienceId: z.string() }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleDeleteExperience,
    );

    server.registerTool(
        "move_experience",
        {
            description:
                "Move one of this account's experience entries up or down.",
            inputSchema: z.object({
                experienceId: z.string(),
                direction: directionSchema,
            }),
            scopeChallenge: requireScopes("portfolio:write"),
        },
        handleMoveExperience,
    );
}
