import { init } from "@paralleldrive/cuid2";

import prisma from "@/db";
import type { Prisma } from "@/generated/prisma/client";

export type OrgActor = { userId: string };

export type OrgRole = "owner" | "admin" | "member";

export type OrgSummary = {
    id: string;
    name: string;
    username: string;
    role: OrgRole;
};

export type OrgMember = {
    userId: string;
    username: string;
    name: string | null;
    role: OrgRole;
};

export type CreateOrganizationInput = {
    name: string;
    username: string;
    summary?: string | null;
    socials?: unknown;
    imageUrl?: string | null;
};

export type UpdateOrganizationInput = Partial<CreateOrganizationInput> & {
    organizationId: string;
};

/**
 * A row that does not exist is how Prisma reports "the predicate you gave me
 * matched nothing" — which for these writes means "not yours".
 */
function isNotFound(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2025"
    );
}

function notAuthorized(error: unknown): never {
    if (isNotFound(error)) throw new Error("Not authorized");
    throw error;
}

/**
 * The owner check happens before the write, so a non-owner never reaches the
 * mutation at all. The owner predicate stays on the mutation too, so a
 * concurrent ownership change cannot reopen the hole.
 */
async function assertOwner(
    actor: OrgActor,
    organizationId: string,
): Promise<void> {
    const existing = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
    });
    if (!existing || existing.ownerId !== actor.userId) {
        throw new Error("Not authorized");
    }
}

/**
 * The owner check on its own, so a caller can refuse before it spends
 * anything on the caller's behalf, such as uploading an image.
 */
export async function assertOrganizationOwner(
    actor: OrgActor,
    organizationId: string,
): Promise<void> {
    await assertOwner(actor, organizationId);
}

/**
 * The user behind a username. It is here because the only use is resolving
 * the member a membership action is about.
 */
export async function findUserByUsername(
    username: string,
): Promise<{ id: string; username: string } | null> {
    return prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
    });
}

export async function createOrganization(actor: OrgActor, input: CreateOrganizationInput) {
    const taken = await prisma.organization.findUnique({
        where: { username: input.username },
        select: { id: true },
    });
    if (taken) throw new Error("Username already taken");

    return prisma.organization.create({
        data: {
            secret: `sk-${init({ length: 48 })()}`,
            name: input.name,
            username: input.username,
            ...(input.summary !== undefined && { summary: input.summary }),
            socials: (input.socials ?? []) as Prisma.InputJsonValue[],
            // The column is not nullable and has no default, so an
            // organization created without an image stores an empty one.
            image: input.imageUrl ?? "",
            owner: { connect: { id: actor.userId } },
        },
        include: { owner: true, admins: true, members: true },
    });
}

export async function updateOrganization(
    actor: OrgActor,
    input: UpdateOrganizationInput,
) {
    await assertOwner(actor, input.organizationId);
    try {
        return await prisma.organization.update({
            where: { id: input.organizationId, ownerId: actor.userId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.username !== undefined && { username: input.username }),
                ...(input.summary !== undefined && { summary: input.summary }),
                ...(input.socials !== undefined && {
                    socials: input.socials as Prisma.InputJsonValue[],
                }),
                ...(input.imageUrl && { image: input.imageUrl }),
            },
            include: { owner: true, admins: true, members: true },
        });
    } catch (error) {
        notAuthorized(error);
    }
}

export async function listOrganizations(
    actor: OrgActor,
): Promise<OrgSummary[]> {
    const organizations = await prisma.organization.findMany({
        where: {
            OR: [
                { ownerId: actor.userId },
                { admins: { some: { id: actor.userId } } },
                { members: { some: { id: actor.userId } } },
            ],
        },
        select: {
            id: true,
            name: true,
            username: true,
            ownerId: true,
            admins: { select: { id: true } },
            members: { select: { id: true } },
        },
    });

    return organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        username: organization.username,
        role: roleOf(organization, actor.userId),
    }));
}

function roleOf(
    organization: { ownerId: string; admins: { id: string }[] },
    userId: string,
): OrgRole {
    if (organization.ownerId === userId) return "owner";
    if (organization.admins.some((admin) => admin.id === userId)) {
        return "admin";
    }
    return "member";
}

export async function getOrganization(
    actor: OrgActor,
    input: { organizationId: string },
): Promise<{
    id: string;
    name: string;
    username: string;
    members: OrgMember[];
}> {
    const organization = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: {
            id: true,
            name: true,
            username: true,
            ownerId: true,
            owner: { select: { id: true, username: true, name: true } },
            admins: { select: { id: true, username: true, name: true } },
            members: { select: { id: true, username: true, name: true } },
        },
    });
    if (!organization) throw new Error("Organization not found");
    const isMember =
        organization.ownerId === actor.userId ||
        organization.admins.some((admin) => admin.id === actor.userId) ||
        organization.members.some((member) => member.id === actor.userId);
    if (!isMember) throw new Error("Not authorized");

    return {
        id: organization.id,
        name: organization.name,
        username: organization.username,
        members: [
            {
                userId: organization.owner.id,
                username: organization.owner.username,
                name: organization.owner.name,
                role: "owner",
            },
            ...organization.admins.map((admin) => ({
                userId: admin.id,
                username: admin.username,
                name: admin.name,
                role: "admin" as const,
            })),
            ...organization.members.map((member) => ({
                userId: member.id,
                username: member.username,
                name: member.name,
                role: "member" as const,
            })),
        ],
    };
}

/**
 * Adding and removing a member is open to an admin as well as the owner: the
 * authorization lives in the predicate, so a caller who is neither matches
 * no row and Prisma reports it as missing.
 */
export async function addOrganizationMember(
    actor: OrgActor,
    input: { organizationId: string; memberId: string },
): Promise<void> {
    try {
        await prisma.organization.update({
            where: {
                id: input.organizationId,
                OR: [
                    { ownerId: actor.userId },
                    { admins: { some: { id: actor.userId } } },
                ],
            },
            data: { members: { connect: { id: input.memberId } } },
            select: { id: true },
        });
    } catch (error) {
        notAuthorized(error);
    }
}

export async function removeOrganizationMember(
    actor: OrgActor,
    input: { organizationId: string; memberId: string },
): Promise<void> {
    try {
        await prisma.organization.update({
            where: {
                id: input.organizationId,
                OR: [
                    { ownerId: actor.userId },
                    { admins: { some: { id: actor.userId } } },
                ],
            },
            data: { members: { disconnect: { id: input.memberId } } },
            select: { id: true },
        });
    } catch (error) {
        notAuthorized(error);
    }
}

/**
 * Promoting and demoting are owner-only: an admin manages the member list,
 * not the admin list.
 */
export async function promoteOrganizationMember(
    actor: OrgActor,
    input: { organizationId: string; memberId: string },
): Promise<void> {
    await assertOwner(actor, input.organizationId);
    try {
        await prisma.organization.update({
            where: { id: input.organizationId, ownerId: actor.userId },
            data: { admins: { connect: { id: input.memberId } } },
            select: { id: true },
        });
    } catch (error) {
        notAuthorized(error);
    }
}

export async function demoteOrganizationMember(
    actor: OrgActor,
    input: { organizationId: string; memberId: string },
): Promise<void> {
    await assertOwner(actor, input.organizationId);
    const owner = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { ownerId: true },
    });
    // The owner owns the organization outright; there is no role to strip.
    if (owner?.ownerId === input.memberId) {
        throw new Error("Not authorized");
    }
    try {
        await prisma.organization.update({
            where: { id: input.organizationId, ownerId: actor.userId },
            data: { admins: { disconnect: { id: input.memberId } } },
            select: { id: true },
        });
    } catch (error) {
        notAuthorized(error);
    }
}
