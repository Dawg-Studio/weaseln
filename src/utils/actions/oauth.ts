import { randomBytes } from "crypto";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/db";
import { findOAuthClient, hashSecret } from "@/modules/oauth/clients";
import {
    isAllowedRedirectUri,
    matchesRedirectUri,
} from "@/modules/oauth/redirect-uri";
import {
    isScopeSubset,
    OAUTH_SCOPES,
    parseScopes,
} from "@/modules/oauth/scopes";
import {
    listOAuthClients,
    registerOAuthClient,
    revokeOAuthClient,
} from "@/modules/oauth/clients";

const CODE_TTL_SECONDS = 60;

export type AuthorizationRequest = {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    state: string;
};

/**
 * The approval path. Every check happens before a code exists, so a code is
 * only ever minted for a client the signed-in user owns, a redirect URI that
 * client registered, an S256 challenge, and scopes that client may request.
 */
export async function approveAuthorization(
    input: AuthorizationRequest,
): Promise<void> {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");

    const client = await findOAuthClient(input.clientId);
    if (!client || client.revokedAt) throw new Error("Not authorized");
    if (client.userId !== session.user.id) throw new Error("Not authorized");
    if (!matchesRedirectUri(client.redirectUris, input.redirectUri)) {
        throw new Error("Invalid redirect URI");
    }
    if (
        input.codeChallengeMethod !== "S256" ||
        !input.codeChallenge
    ) {
        throw new Error("Invalid code challenge");
    }
    const scopes = parseScopes(input.scope);
    if (!isScopeSubset(scopes, client.scopes)) {
        throw new Error("Invalid scope");
    }

    const code = randomBytes(32).toString("base64url");
    await prisma.oAuthAuthorizationCode.create({
        data: {
            codeHash: hashSecret(code),
            clientId: client.clientId,
            userId: session.user.id,
            redirectUri: input.redirectUri,
            codeChallenge: input.codeChallenge,
            scopes,
            expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
        },
    });

    const url = new URL(input.redirectUri);
    url.searchParams.set("code", code);
    url.searchParams.set("state", input.state);
    redirect(url.toString());
}

/**
 * Registering a client for the settings page. The redirect URI has to be
 * https or a loopback address, and the scopes have to be ones the app knows.
 */
export async function createMcpClient(input: {
    name: string;
    redirectUris: string[];
    scopes: string[];
}): Promise<{ clientId: string; clientSecret: string }> {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");

    for (const uri of input.redirectUris) {
        if (!isAllowedRedirectUri(uri)) {
            throw new Error("Invalid redirect URI");
        }
    }
    const scopes = input.scopes.filter((scope) =>
        (OAUTH_SCOPES as readonly string[]).includes(scope),
    );
    if (scopes.length !== input.scopes.length) {
        throw new Error("Invalid scope");
    }

    return registerOAuthClient(
        { userId: session.user.id },
        { name: input.name, redirectUris: input.redirectUris, scopes },
    );
}

export async function revokeMcpClient(input: {
    clientId: string;
}): Promise<void> {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    await revokeOAuthClient({ userId: session.user.id }, input);
}

export async function listMcpClients(): Promise<
    Awaited<ReturnType<typeof listOAuthClients>>
> {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    return listOAuthClients({ userId: session.user.id });
}

/**
 * The refusal path. The redirect URI is checked against the client's
 * registered URIs here too, so this action cannot be used as an open
 * redirect.
 */
export async function denyAuthorization(input: {
    clientId: string;
    redirectUri: string;
    state: string;
}): Promise<void> {
    const session = await auth();
    if (!session?.user) throw new Error("Not authenticated");
    const client = await findOAuthClient(input.clientId);
    if (!client) throw new Error("Invalid client");
    if (!matchesRedirectUri(client.redirectUris, input.redirectUri)) {
        throw new Error("Invalid redirect URI");
    }

    const url = new URL(input.redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("state", input.state);
    redirect(url.toString());
}
