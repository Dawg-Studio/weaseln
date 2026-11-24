import { createHash, timingSafeEqual } from "crypto";

import { init } from "@paralleldrive/cuid2";

import prisma from "@/db";

import { fetchClientMetadata, isClientMetadataUrl } from "./client-metadata";

export type OAuthClientSummary = {
    id: string;
    clientId: string;
    name: string;
    redirectUris: string[];
    scopes: string[];
    createdAt: Date;
    revokedAt: Date | null;
};

export type OAuthClientRecord = {
    id: string;
    clientId: string;
    clientSecretHash: string;
    name: string;
    redirectUris: string[];
    scopes: string[];
    userId: string;
    revokedAt: Date | null;
};

export function hashSecret(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

/**
 * The comparison is constant time so a caller cannot learn the hash by
 * measuring how long the comparison takes.
 */
export function verifyClientSecret(
    storedHash: string,
    presented: string,
): boolean {
    const stored = Buffer.from(storedHash, "hex");
    const presentedHash = Buffer.from(hashSecret(presented), "hex");
    if (stored.length !== presentedHash.length) return false;
    return timingSafeEqual(stored, presentedHash);
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

/**
 * The secret is returned exactly once. The row holds its hash.
 */
export async function registerOAuthClient(
    actor: { userId: string },
    input: { name: string; redirectUris: string[]; scopes: string[] },
): Promise<{ clientId: string; clientSecret: string }> {
    const clientId = init({ length: 32 })();
    const clientSecret = `sk-${init({ length: 48 })()}`;

    await prisma.oAuthClient.create({
        data: {
            clientId,
            clientSecretHash: hashSecret(clientSecret),
            name: input.name,
            redirectUris: input.redirectUris,
            scopes: input.scopes,
            userId: actor.userId,
        },
    });

    return { clientId, clientSecret };
}

export async function listOAuthClients(
    actor: { userId: string },
): Promise<OAuthClientSummary[]> {
    const clients = await prisma.oAuthClient.findMany({
        where: { userId: actor.userId },
        select: {
            id: true,
            clientId: true,
            name: true,
            redirectUris: true,
            scopes: true,
            createdAt: true,
            revokedAt: true,
        },
    });

    return clients.map((client) => ({
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        redirectUris: toStringArray(client.redirectUris),
        scopes: client.scopes,
        createdAt: client.createdAt,
        revokedAt: client.revokedAt,
    }));
}

export async function findOAuthClient(
    clientId: string,
): Promise<OAuthClientRecord | null> {
    const client = await prisma.oAuthClient.findUnique({
        where: { clientId },
        select: {
            id: true,
            clientId: true,
            clientSecretHash: true,
            name: true,
            redirectUris: true,
            scopes: true,
            userId: true,
            revokedAt: true,
        },
    });
    if (!client) return null;
    return {
        id: client.id,
        clientId: client.clientId,
        clientSecretHash: client.clientSecretHash,
        name: client.name,
        redirectUris: toStringArray(client.redirectUris),
        scopes: client.scopes,
        userId: client.userId,
        revokedAt: client.revokedAt,
    };
}

export type ResolvedClient = {
    clientId: string;
    name: string;
    redirectUris: string[];
    allowedScopes: string[] | null;
    origin: string | null;
    public: boolean;
    userId: string | null;
};

/**
 * A registered client wins over a metadata URL, so an id that Settings already
 * issued can never be reinterpreted as one. `null` means no such client.
 */
export async function resolveClient(
    clientId: string,
): Promise<ResolvedClient | null> {
    const registered = await findOAuthClient(clientId);
    if (registered) {
        if (registered.revokedAt) return null;
        return {
            clientId: registered.clientId,
            name: registered.name,
            redirectUris: registered.redirectUris,
            allowedScopes: registered.scopes,
            origin: null,
            public: false,
            userId: registered.userId,
        };
    }
    if (!isClientMetadataUrl(clientId)) return null;

    const metadata = await fetchClientMetadata(clientId);
    return {
        clientId: metadata.clientId,
        name: metadata.clientName,
        redirectUris: metadata.redirectUris,
        allowedScopes: null,
        origin: new URL(clientId).hostname,
        public: true,
        userId: null,
    };
}

/**
 * Revoking a client kills its refresh tokens too, so a session cannot be
 * renewed after the credential is withdrawn.
 */
export async function revokeOAuthClient(
    actor: { userId: string },
    input: { clientId: string },
): Promise<void> {
    try {
        await prisma.oAuthClient.update({
            where: { clientId: input.clientId, userId: actor.userId },
            data: { revokedAt: new Date() },
        });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: unknown }).code === "P2025"
        ) {
            throw new Error("Not authorized");
        }
        throw error;
    }
    await prisma.oAuthRefreshToken.updateMany({
        where: { clientId: input.clientId },
        data: { revokedAt: new Date() },
    });
}
