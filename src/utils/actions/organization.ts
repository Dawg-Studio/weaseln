"use server";

import { auth } from "@/auth";
import prisma from "@/db";
import { init } from "@paralleldrive/cuid2";
import {
    addOrganizationMember,
    demoteOrganizationMember,
    promoteOrganizationMember,
    removeOrganizationMember,
} from "@/modules/organization/service";

export async function rerollSecretKey(organizationId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    const createdId = init({ length: 48 });
    const apiKey = `sk-${createdId()}`;
    const result = await prisma.organization.update({
        where: { id: organizationId, ownerId: session.user.id },
        data: { secret: apiKey },
        select: { secret: true },
    });
    return result.secret;
}

export async function joinOrganizationWithSK(secret: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    return prisma.$transaction(async (tx) => {
        try {
            return await tx.organization.update({
                where: { secret },
                data: { members: { connect: { id: session.user.id } } },
                select: {
                    id: true,
                    owner: { select: { id: true, name: true, image: true } },
                    admins: { select: { id: true } },
                    members: { select: { id: true } },
                },
            });
        } catch (e) {
            if (
                typeof e === "object" &&
                e !== null &&
                "code" in e &&
                (e as { code?: unknown }).code === "P2025"
            ) {
                throw new Error("Invalid secret");
            }
            throw e;
        }
    });
}

/**
 * The membership rules live in the organization service, so the page and the
 * MCP tools get the same authorization. These actions only carry the
 * session's user into it.
 */

export async function addMember(organizationId: string, memberId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    await addOrganizationMember(
        { userId: session.user.id },
        { organizationId, memberId },
    );
}

export async function addAdmin(organizationId: string, adminId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    await promoteOrganizationMember(
        { userId: session.user.id },
        { organizationId, memberId: adminId },
    );
}

export async function removeAdmin(organizationId: string, adminId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    await demoteOrganizationMember(
        { userId: session.user.id },
        { organizationId, memberId: adminId },
    );
}

export async function removeMember(organizationId: string, memberId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    await removeOrganizationMember(
        { userId: session.user.id },
        { organizationId, memberId },
    );
}
