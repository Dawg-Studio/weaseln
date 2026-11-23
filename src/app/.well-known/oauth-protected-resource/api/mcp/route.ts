import { NextResponse } from "next/server";

import { OAUTH_SCOPES } from "@/modules/oauth/scopes";

/**
 * RFC 9728. The 401 challenge from the MCP endpoint points a client here,
 * and this document names the authorization server that issues the tokens.
 */
export async function GET(req: Request) {
    const origin = new URL(req.url).origin;

    return NextResponse.json(
        {
            resource: `${origin}/api/mcp`,
            authorization_servers: [origin],
            bearer_methods_supported: ["header"],
            scopes_supported: [...OAUTH_SCOPES],
        },
        { status: 200 },
    );
}
