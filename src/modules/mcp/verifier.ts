import {
    OAuthError,
    OAuthErrorCode,
    type AuthInfo,
} from "@modelcontextprotocol/server";

import { verifyAccessToken } from "@/modules/oauth/tokens";

/**
 * The resource the MCP endpoint answers on. It comes from the request, so
 * the same build serves every host without a configured base URL.
 */
export function getMcpServerUrl(request: Request): URL {
    return new URL("/api/mcp", request.url);
}

/**
 * The one function that turns a bearer token into a caller. The SDK never
 * issues tokens, so this is where an access token is checked.
 */
export async function verifyMcpAccessToken(token: string): Promise<AuthInfo> {
    try {
        const claims = verifyAccessToken(token);
        if (!claims) throw new Error("Invalid access token");

        return {
            token,
            clientId: claims.clientId,
            scopes: claims.scopes,
            // Both of these have to be filled in: the SDK refuses a token
            // with no expiry, and refuses one with no resource when the
            // endpoint expects a particular one.
            expiresAt: claims.expiresAt,
            resource: new URL(claims.audience),
            extra: { userId: claims.userId },
        };
    } catch (error) {
        // The SDK maps an OAuthError to a 401 challenge. A plain error would
        // answer 500 and tell the caller nothing useful.
        console.error("MCP access token rejected", error);
        throw new OAuthError(
            OAuthErrorCode.InvalidToken,
            "Invalid access token",
        );
    }
}
