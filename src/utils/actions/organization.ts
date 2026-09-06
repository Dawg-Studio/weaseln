"use server";

import prisma from "@/db";
import { init } from "@paralleldrive/cuid2";
import { auth } from "@/auth";

// ponytail: Prisma 7's updateMany data type is scalar-only — M2M connect/disconnect
// in `data` is rejected by the generated types (OrganizationUpdateManyMutationInput
// has no relations). The authz-in-`where` + P2025-catch pattern on `update` is the
// only way to push authz to the SQL layer AND touch a relation in one round trip.

function rethrowAuthz(e: unknown): never {
    if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: unknown }).code === "P2025"
    ) {
        throw new Error("Not authorized");
    }
    throw e as Error;
}

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
    try {
        await prisma.organization.update({
            where: { secret },
            data: { members: { connect: { id: session.user.id } } },
            select: { id: true },
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
}

export async function addAdmin(organizationId: string, adminId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    try {
        await prisma.organization.update({
            where: { id: organizationId, ownerId: session.user.id },
            data: { admins: { connect: { id: adminId } } },
            select: { id: true },
        });
    } catch (e) {
        rethrowAuthz(e);
    }
}

export async function addMember(organizationId: string, memberId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    try {
        await prisma.organization.update({
            where: {
                id: organizationId,
                OR: [
                    { ownerId: session.user.id },
                    { admins: { some: { id: session.user.id } } },
                ],
            },
            data: { members: { connect: { id: memberId } } },
            select: { id: true },
        });
    } catch (e) {
        rethrowAuthz(e);
    }
}

export async function removeAdmin(organizationId: string, adminId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    try {
        await prisma.organization.update({
            where: { id: organizationId, ownerId: session.user.id },
            data: { admins: { disconnect: { id: adminId } } },
            select: { id: true },
        });
    } catch (e) {
        rethrowAuthz(e);
    }
}

export async function removeMember(organizationId: string, memberId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    try {
        await prisma.organization.update({
            where: {
                id: organizationId,
                OR: [
                    { ownerId: session.user.id },
                    { admins: { some: { id: session.user.id } } },
                ],
            },
            data: { members: { disconnect: { id: memberId } } },
            select: { id: true },
        });
    } catch (e) {
        rethrowAuthz(e);
    }
}
