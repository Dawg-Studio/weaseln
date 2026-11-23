import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
    addOrganizationMember,
    createOrganization,
    demoteOrganizationMember,
    findUserByUsername,
    getOrganization,
    listOrganizations,
    promoteOrganizationMember,
    removeOrganizationMember,
    updateOrganization,
} from "@/modules/organization/service";

import { callerOf, text, toolError, type ToolContext } from "./shared";

type ListOrgsArgs = Record<string, never>;

type GetOrgArgs = { orgId: string };

type CreateOrgArgs = {
    name: string;
    username: string;
    summary?: string;
    socials?: { name: string; url: string }[];
    imageUrl?: string;
};

type UpdateOrgArgs = {
    orgId: string;
    name?: string;
    username?: string;
    summary?: string;
    socials?: { name: string; url: string }[];
    imageUrl?: string;
};

type UpdateMemberArgs = {
    orgId: string;
    username: string;
    action: "add" | "remove" | "promote" | "demote";
};

export async function handleListOrgs(_args: ListOrgsArgs, ctx: ToolContext) {
    try {
        const caller = callerOf(ctx);
        const organizations = await listOrganizations({
            userId: caller.userId,
        });
        return text({ data: organizations });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleGetOrg(args: GetOrgArgs, ctx: ToolContext) {
    try {
        const caller = callerOf(ctx);
        const organization = await getOrganization(
            { userId: caller.userId },
            { organizationId: args.orgId },
        );
        return text({ data: organization });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleCreateOrg(
    args: CreateOrgArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const organization = await createOrganization(
            { userId: caller.userId },
            {
                name: args.name,
                username: args.username,
                summary: args.summary,
                socials: args.socials,
                imageUrl: args.imageUrl,
            },
        );
        return text({
            id: organization.id,
            name: organization.name,
            username: organization.username,
        });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateOrg(
    args: UpdateOrgArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const organization = await updateOrganization(
            { userId: caller.userId },
            {
                organizationId: args.orgId,
                name: args.name,
                username: args.username,
                summary: args.summary,
                socials: args.socials,
                imageUrl: args.imageUrl,
            },
        );
        return text({
            id: organization.id,
            name: organization.name,
            username: organization.username,
        });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleUpdateOrgMember(
    args: UpdateMemberArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const member = await findUserByUsername(args.username);
        if (!member) {
            throw new Error(`No user named ${args.username}`);
        }

        const input = {
            organizationId: args.orgId,
            memberId: member.id,
        };
        switch (args.action) {
            case "add":
                await addOrganizationMember({ userId: caller.userId }, input);
                break;
            case "remove":
                await removeOrganizationMember({ userId: caller.userId }, input);
                break;
            case "promote":
                await promoteOrganizationMember({ userId: caller.userId }, input);
                break;
            case "demote":
                await demoteOrganizationMember({ userId: caller.userId }, input);
                break;
        }
        return text({ username: member.username, action: args.action });
    } catch (error) {
        return toolError(error);
    }
}

export function registerOrganizationTools(server: McpServer) {
    server.registerTool(
        "list_orgs",
        {
            description:
                "List the organizations this account owns, administers, or belongs to, with the role it has in each.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("org:read"),
        },
        handleListOrgs,
    );

    server.registerTool(
        "get_org",
        {
            description:
                "Read one organization and its members, with the role each member has.",
            inputSchema: z.object({ orgId: z.string() }),
            scopeChallenge: requireScopes("org:read"),
        },
        handleGetOrg,
    );

    server.registerTool(
        "create_org",
        {
            description: "Create an organization owned by this account.",
            inputSchema: z.object({
                name: z.string(),
                username: z.string(),
                summary: z.string().optional(),
                socials: z
                    .array(z.object({ name: z.string(), url: z.string() }))
                    .optional(),
                imageUrl: z.string().optional(),
            }),
            scopeChallenge: requireScopes("org:write"),
        },
        handleCreateOrg,
    );

    server.registerTool(
        "update_org",
        {
            description:
                "Change an organization this account owns. Another account's organization is refused.",
            inputSchema: z.object({
                orgId: z.string(),
                name: z.string().optional(),
                username: z.string().optional(),
                summary: z.string().optional(),
                socials: z
                    .array(z.object({ name: z.string(), url: z.string() }))
                    .optional(),
                imageUrl: z.string().optional(),
            }),
            scopeChallenge: requireScopes("org:write"),
        },
        handleUpdateOrg,
    );

    server.registerTool(
        "update_org_member",
        {
            description:
                "Add, remove, promote or demote a member of an organization this account owns.",
            inputSchema: z.object({
                orgId: z.string(),
                username: z.string(),
                action: z.enum(["add", "remove", "promote", "demote"]),
            }),
            scopeChallenge: requireScopes("org:write"),
        },
        handleUpdateOrgMember,
    );
}
