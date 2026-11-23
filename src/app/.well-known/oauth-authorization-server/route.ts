import { NextResponse } from "next/server";

import { OAUTH_SCOPES } from "@/modules/oauth/scopes";

/**
 * RFC 8414. The origin comes from the request, so the same build serves every
 * host without a configured base URL.
 */
export async function GET(req: Request) {
    const origin = new URL(req.url).origin;

    return NextResponse.json(
        {
            issuer: origin,
            authorization_endpoint: `${origin}/oauth/authorize`,
            token_endpoint: `${origin}/oauth/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: [
                "client_secret_basic",
                "client_secret_post",
            ],
            scopes_supported: [...OAUTH_SCOPES],
        },
        { status: 200 },
    );
}
