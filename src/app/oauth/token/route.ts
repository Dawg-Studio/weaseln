import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import prisma from "@/db";
import {
    findOAuthClient,
    hashSecret,
    verifyClientSecret,
} from "@/modules/oauth/clients";
import { verifyPkceChallenge } from "@/modules/oauth/pkce";
import { signAccessToken } from "@/modules/oauth/tokens";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

function oauthError(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

/**
 * A confidential client authenticates with HTTP Basic, or with the two form
 * fields, and both spellings are accepted by the spec.
 */
function readClientCredentials(
    req: Request,
    body: FormData,
): { clientId: string; clientSecret: string } | null {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Basic ")) {
        const decoded = Buffer.from(header.slice(6), "base64").toString(
            "utf8",
        );
        const separator = decoded.indexOf(":");
        if (separator === -1) return null;
        return {
            clientId: decodeURIComponent(decoded.slice(0, separator)),
            clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        };
    }

    const clientId = body.get("client_id");
    const clientSecret = body.get("client_secret");
    if (typeof clientId === "string" && typeof clientSecret === "string") {
        return { clientId, clientSecret };
    }
    return null;
}

async function issueTokens(input: {
    clientId: string;
    userId: string;
    scopes: string[];
    audience: string;
}) {
    const accessToken = signAccessToken({
        userId: input.userId,
        clientId: input.clientId,
        scopes: input.scopes,
        audience: input.audience,
        expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = randomBytes(32).toString("base64url");
    await prisma.oAuthRefreshToken.create({
        data: {
            tokenHash: hashSecret(refreshToken),
            clientId: input.clientId,
            userId: input.userId,
            scopes: input.scopes,
            expiresAt: new Date(
                Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
            ),
        },
    });

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        scope: input.scopes.join(" "),
    };
}

export async function POST(req: Request) {
    const body = await req.formData();
    const grantType = body.get("grant_type");

    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
        return oauthError("unsupported_grant_type", 400);
    }

    const credentials = readClientCredentials(req, body);
    if (!credentials) return oauthError("invalid_client", 401);

    const client = await findOAuthClient(credentials.clientId);
    if (
        !client ||
        client.revokedAt ||
        !verifyClientSecret(client.clientSecretHash, credentials.clientSecret)
    ) {
        return oauthError("invalid_client", 401);
    }

    const audience = new URL("/api/mcp", req.url).toString();

    if (grantType === "authorization_code") {
        const code = body.get("code");
        const redirectUri = body.get("redirect_uri");
        const codeVerifier = body.get("code_verifier");
        if (
            typeof code !== "string" ||
            typeof redirectUri !== "string" ||
            typeof codeVerifier !== "string"
        ) {
            return oauthError("invalid_request", 400);
        }

        const stored = await prisma.oAuthAuthorizationCode.findUnique({
            where: { codeHash: hashSecret(code) },
        });
        if (
            !stored ||
            stored.usedAt ||
            stored.expiresAt.getTime() < Date.now() ||
            stored.clientId !== client.clientId ||
            stored.redirectUri !== redirectUri
        ) {
            return oauthError("invalid_grant", 400);
        }
        if (
            !verifyPkceChallenge({
                challenge: stored.codeChallenge,
                method: "S256",
                verifier: codeVerifier,
            })
        ) {
            return oauthError("invalid_grant", 400);
        }

        // Spending the code is what decides whether it can be redeemed. Two
        // concurrent requests both read it as unused, so the read cannot be
        // the gate: only one conditional update takes the row.
        const spent = await prisma.oAuthAuthorizationCode.updateMany({
            where: { id: stored.id, usedAt: null },
            data: { usedAt: new Date() },
        });
        if (spent.count === 0) {
            return oauthError("invalid_grant", 400);
        }

        const tokens = await issueTokens({
            clientId: client.clientId,
            userId: stored.userId,
            scopes: stored.scopes,
            audience,
        });
        return NextResponse.json(tokens, { status: 200 });
    }

    const refreshToken = body.get("refresh_token");
    if (typeof refreshToken !== "string") {
        return oauthError("invalid_request", 400);
    }
    const stored = await prisma.oAuthRefreshToken.findUnique({
        where: { tokenHash: hashSecret(refreshToken) },
    });
    if (
        !stored ||
        stored.revokedAt ||
        stored.expiresAt.getTime() < Date.now() ||
        stored.clientId !== client.clientId
    ) {
        return oauthError("invalid_grant", 400);
    }

    // Rotation: the presented refresh token is spent and a new one is minted.
    // The spend decides, for the same reason the code's spend decides.
    const spent = await prisma.oAuthRefreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (spent.count === 0) {
        return oauthError("invalid_grant", 400);
    }

    const tokens = await issueTokens({
        clientId: client.clientId,
        userId: stored.userId,
        scopes: stored.scopes,
        audience,
    });
    return NextResponse.json(tokens, { status: 200 });
}
