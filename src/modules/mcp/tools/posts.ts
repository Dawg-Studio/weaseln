import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
    POST_BACKGROUNDS,
    POST_IMAGE_FITS,
    POST_PATTERNS,
} from "@/modules/post-customization/types";
import {
    assertAllowedImageUrl,
    validatePostCustomizationInput,
} from "@/modules/post-customization/validation";
import {
    createPost,
    deletePost,
    getPost,
    listPosts,
    updatePost,
} from "@/modules/posts/service";
import {
    findUnsupportedNodes,
    markdownToTiptap,
    tiptapToMarkdown,
} from "@/modules/post-content/markdown";
import { listOrganizations } from "@/modules/organization/service";

import {
    callerOf,
    text,
    toolError,
    type ScopeChallengeHandler,
    type ToolContext,
} from "./shared";

const WORDS_PER_MINUTE = 238;

const designSchema = z
    .object({
        backgroundColor: z
            .string()
            .optional()
            .describe(`One of: ${POST_BACKGROUNDS.join(", ")}`),
        backgroundPattern: z
            .string()
            .optional()
            .describe(`One of: ${POST_PATTERNS.join(", ")}`),
        backgroundImage: z.string().optional(),
        backgroundFit: z
            .string()
            .optional()
            .describe(`One of: ${POST_IMAGE_FITS.join(", ")}`),
    })
    .optional();

type Design = z.infer<typeof designSchema>;

type ListPostsArgs = {
    published?: boolean;
    orgId?: string;
    q?: string;
    cursor?: string;
};

type GetPostArgs = { id: string };

type WritePostArgs = {
    title: string;
    description?: string;
    contentMarkdown: string;
    tags?: string[];
    orgId?: string;
    published?: boolean;
    coverImageUrl?: string;
    design?: Design;
    allowFlatten?: boolean;
};

type UpdatePostArgs = Omit<WritePostArgs, "title" | "contentMarkdown"> & {
    id: string;
    title?: string;
    contentMarkdown?: string;
};

type DeletePostArgs = { id: string };

function readPerMinute(markdown: string): number {
    const words = markdown
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    return Math.round(words / WORDS_PER_MINUTE);
}

/**
 * A post can only be filed under an organization the caller belongs to.
 * Without this check a caller could file a post under anyone's
 * organization.
 */
async function assertOrganizationMember(
    userId: string,
    organizationId: string | undefined,
): Promise<void> {
    if (!organizationId) return;
    const organizations = await listOrganizations({ userId });
    const member = organizations.some(
        (organization) => organization.id === organizationId,
    );
    if (!member) {
        throw new Error("You do not belong to that organization.");
    }
}

export const listPostsScopeChallenge: ScopeChallengeHandler = ({
    request,
    authInfo,
}) => {
    const scopes = authInfo?.scopes ?? [];
    const args = (
        request.params as { arguments?: { orgId?: unknown } } | undefined
    )?.arguments;
    const required = args?.orgId ? ["posts:read", "org:read"] : ["posts:read"];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (missing.length === 0) return undefined;
    return {
        scopes: required as [string, ...string[]],
        errorDescription: `This tool needs ${required.join(" and ")}.`,
    };
};

export async function handleListPosts(args: ListPostsArgs, ctx: ToolContext) {
    try {
        const caller = callerOf(ctx);
        // The organization membership check is in the service, so every path
        // to the posts is covered by it.
        const posts = await listPosts(
            { userId: caller.userId },
            {
                published: args.published,
                organizationId: args.orgId,
                q: args.q,
                cursor: args.cursor,
            },
        );
        return text({ data: posts });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleGetPost(args: GetPostArgs, ctx: ToolContext) {
    try {
        const caller = callerOf(ctx);
        const post = await getPost(
            { userId: caller.userId },
            { postId: args.id },
        );
        return text({
            ...post,
            contentMarkdown: tiptapToMarkdown(post.content),
            content: undefined,
        });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleCreatePost(
    args: WritePostArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        if (args.coverImageUrl) assertAllowedImageUrl(args.coverImageUrl, "coverImage");
        if (args.design) validatePostCustomizationInput(args.design);
        await assertOrganizationMember(caller.userId, args.orgId);
        const post = await createPost(
            { userId: caller.userId },
            {
                title: args.title,
                description: args.description ?? "",
                content: markdownToTiptap(args.contentMarkdown),
                tags: args.tags ?? [],
                readPerMinute: readPerMinute(args.contentMarkdown),
                published: args.published ?? false,
                organizationId: args.orgId,
                customization: args.design,
                coverImage: args.coverImageUrl,
            },
        );
        return text(post);
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdatePost(
    args: UpdatePostArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        if (args.coverImageUrl) assertAllowedImageUrl(args.coverImageUrl, "coverImage");
        if (args.design) validatePostCustomizationInput(args.design);
        await assertOrganizationMember(caller.userId, args.orgId);
        const stored = await getPost(
            { userId: caller.userId },
            { postId: args.id },
        );
        // The refusal only applies when the body is being replaced: an update
        // that leaves the body alone cannot flatten it.
        if (args.contentMarkdown !== undefined) {
            const unsupported = findUnsupportedNodes(stored.content);
            if (unsupported.length > 0 && !args.allowFlatten) {
                return toolError(
                    new Error(
                        `This post contains ${unsupported.join(", ")}, which cannot be represented in markdown. Pass allowFlatten to replace it.`,
                    ),
                );
            }
        }
        const post = await updatePost(
            { userId: caller.userId },
            {
                postId: args.id,
                // A field the caller did not name keeps the value it had. The
                // body is only converted when it is given, so an update that
                // changes the tags does not round-trip the writing through
                // markdown.
                title: args.title ?? stored.title,
                description: args.description ?? stored.description,
                content:
                    args.contentMarkdown !== undefined
                        ? markdownToTiptap(args.contentMarkdown)
                        : stored.content,
                tags: args.tags ?? stored.tags,
                readPerMinute:
                    args.contentMarkdown !== undefined
                        ? readPerMinute(args.contentMarkdown)
                        : stored.readPerMinute,
                published: args.published ?? stored.published,
                organizationId: args.orgId,
                customization: args.design,
                coverImage: args.coverImageUrl,
            },
        );
        return text(post);
    } catch (error) {
        return toolError(error);
    }
}

export async function handleDeletePost(
    args: DeletePostArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await deletePost(
            { userId: caller.userId },
            { postId: args.id },
        );
        return text({ deleted: args.id });
    } catch (error) {
        return toolError(error);
    }
}

export function registerPostTools(server: McpServer) {
    server.registerTool(
        "list_posts",
        {
            description:
                "List the posts this account wrote, or the posts of an organization this account belongs to.",
            inputSchema: z.object({
                published: z.boolean().optional(),
                orgId: z.string().optional(),
                q: z.string().optional(),
                cursor: z.string().optional(),
            }),
            scopeChallenge: listPostsScopeChallenge,
        },
        handleListPosts,
    );

    server.registerTool(
        "get_post",
        {
            description:
                "Read one post. The body comes back as markdown so it can be edited and written back.",
            inputSchema: z.object({ id: z.string() }),
            scopeChallenge: requireScopes("posts:read"),
        },
        handleGetPost,
    );

    server.registerTool(
        "create_post",
        {
            description:
                "Write a new post. The body is markdown; the background fields accept the palette slugs.",
            inputSchema: z.object({
                title: z.string(),
                description: z.string().optional(),
                contentMarkdown: z.string(),
                tags: z.array(z.string()).optional(),
                orgId: z.string().optional(),
                published: z.boolean().optional(),
                coverImageUrl: z.string().optional(),
                design: designSchema,
            }),
            scopeChallenge: requireScopes("posts:write"),
        },
        handleCreatePost,
    );

    server.registerTool(
        "update_post",
        {
            description:
                "Replace a post. The body is markdown; an update that would drop an embedded video refuses unless allowFlatten is set.",
            inputSchema: z.object({
                id: z.string(),
                title: z.string().optional(),
                description: z.string().optional(),
                contentMarkdown: z
                    .string()
                    .optional()
                    .describe(
                        "The new body in markdown. Leave it out to keep the body as it is.",
                    ),
                tags: z.array(z.string()).optional(),
                orgId: z.string().optional(),
                published: z.boolean().optional(),
                coverImageUrl: z.string().optional(),
                design: designSchema,
                allowFlatten: z.boolean().optional(),
            }),
            scopeChallenge: requireScopes("posts:write"),
        },
        handleUpdatePost,
    );

    server.registerTool(
        "delete_post",
        {
            description: "Delete one of this account's posts.",
            inputSchema: z.object({ id: z.string() }),
            scopeChallenge: requireScopes("posts:write"),
        },
        handleDeletePost,
    );
}
