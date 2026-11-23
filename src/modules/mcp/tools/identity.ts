import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { listOrganizations } from "@/modules/organization/service";

import { callerOf, text, toolError, type ToolContext } from "./shared";

type WhoamiArgs = { userId?: string };

export async function handleWhoami(_args: WhoamiArgs, ctx: ToolContext) {
    try {
        const caller = callerOf(ctx);
        const organizations = await listOrganizations({
            userId: caller.userId,
        });
        const payload = {
            userId: caller.userId,
            clientId: caller.clientId,
            scopes: caller.scopes,
            organizations: organizations.map((organization) => ({
                id: organization.id,
                name: organization.name,
                username: organization.username,
                role: organization.role,
            })),
        };
        return text(payload);
    } catch (error) {
        return toolError(error);
    }
}

export function registerIdentityTools(server: McpServer) {
    server.registerTool(
        "whoami",
        {
            description:
                "Report the account this token acts as, the organizations it belongs to, and the permissions it carries.",
            inputSchema: z.object({
                userId: z
                    .string()
                    .optional()
                    .describe("Ignored. The account comes from the token."),
            }),
        },
        handleWhoami,
    );
}
