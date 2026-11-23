import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
    getOwnProfile,
    updateOwnProfile,
} from "@/modules/profile/service";

import { callerOf, text, toolError, type ToolContext } from "./shared";

/**
 * The account text, and only it. A strict object rather than a plain one: an
 * agent that names `skills` or `resumeUrl` gets an error it can read instead
 * of a field the schema quietly drops before the service ever sees it.
 */
export const profileUpdateSchema = z.strictObject({
    name: z.string().optional(),
    username: z.string().optional(),
    bio: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    socials: z
        .array(z.object({ name: z.string(), url: z.string() }))
        .optional(),
});

type UpdateProfileArgs = z.infer<typeof profileUpdateSchema>;

export async function handleGetProfile(
    _args: Record<string, never>,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const profile = await getOwnProfile({ userId: caller.userId });
        return text({ data: profile });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateProfile(
    args: UpdateProfileArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const profile = await updateOwnProfile(
            { userId: caller.userId },
            args,
        );
        return text({ data: profile });
    } catch (error) {
        return toolError(error);
    }
}

export function registerProfileTools(server: McpServer) {
    server.registerTool(
        "get_profile",
        {
            description:
                "Read this account's profile text: name, username, bio, location, occupation, email, image, links and skills.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("profile:read"),
        },
        handleGetProfile,
    );

    server.registerTool(
        "update_profile",
        {
            description:
                "Change this account's profile text. Only the fields you name change.",
            inputSchema: profileUpdateSchema,
            scopeChallenge: requireScopes("profile:write"),
        },
        handleUpdateProfile,
    );
}
