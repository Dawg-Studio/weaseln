import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
    applyResumeProposal,
    getResumeState,
    removeResume,
    setResumeVisibility,
    uploadResume,
} from "@/modules/portfolio/resume";

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

export function registerPortfolioTools(server: McpServer) {
    server.registerTool(
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
}
