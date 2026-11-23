import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from "crypto";

/**
 * The signing key is derived from the secret Auth.js already uses, with a
 * context string so the OAuth key is never the same bytes as the session key.
 * No new environment variable is introduced, and `.env.example` ships
 * `NEXTAUTH_SECRET` empty, so the lookup is a truthy check rather than `??`.
 */
const SIGNING_CONTEXT = "weaseln-mcp-oauth-v1";

export type AccessTokenClaims = {
    userId: string;
    clientId: string;
    scopes: string[];
    /** Epoch seconds. */
    expiresAt: number;
    /** The resource the token was minted for. */
    audience: string;
};

export function getOAuthSigningKey(): Buffer {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error(
            "The OAuth signing secret is not configured: set NEXTAUTH_SECRET or AUTH_SECRET",
        );
    }
    return Buffer.from(
        hkdfSync(
            "sha256",
            Buffer.from(secret),
            Buffer.from(SIGNING_CONTEXT),
            Buffer.from(SIGNING_CONTEXT),
            32,
        ),
    );
}

function base64url(value: string | Buffer): string {
    return Buffer.from(value).toString("base64url");
}

export function signAccessToken(claims: {
    userId: string;
    clientId: string;
    scopes: string[];
    audience: string;
    expiresAt: number;
}): string {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        // The authorization server and the MCP endpoint are the same app.
        iss: new URL(claims.audience).origin,
        sub: claims.userId,
        aud: claims.audience,
        scope: claims.scopes.join(" "),
        client_id: claims.clientId,
        iat: Math.floor(Date.now() / 1000),
        exp: claims.expiresAt,
        jti: randomUUID(),
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
        JSON.stringify(payload),
    )}`;
    const signature = createHmac("sha256", getOAuthSigningKey())
        .update(signingInput)
        .digest("base64url");
    return `${signingInput}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expected = createHmac("sha256", getOAuthSigningKey())
        .update(`${header}.${payload}`)
        .digest("base64url");
    const presented = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (presented.length !== wanted.length) return null;
    if (!timingSafeEqual(presented, wanted)) return null;

    let claims: Record<string, unknown>;
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }

    if (typeof claims.exp !== "number") return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;

    return {
        userId: String(claims.sub ?? ""),
        clientId: String(claims.client_id ?? ""),
        scopes: String(claims.scope ?? "")
            .split(" ")
            .filter(Boolean),
        expiresAt: claims.exp,
        audience: String(claims.aud ?? ""),
    };
}
