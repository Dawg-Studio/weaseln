import {
    createMcpHandler,
    requireBearerAuth,
} from "@modelcontextprotocol/server";

import { buildServer } from "@/modules/mcp/server";
import {
    getMcpServerUrl,
    verifyMcpAccessToken,
} from "@/modules/mcp/verifier";

/**
 * A base64 image is a third larger than the image, so a 3 MiB upload becomes
 * roughly 4 MiB of request body.
 */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const handler = createMcpHandler((ctx) => buildServer(ctx.authInfo), {
    maxRequestBodySize: MAX_BODY_BYTES,
});

export async function POST(request: Request) {
    // The gate is built per request because the expected resource is this
    // request's origin.
    const gate = requireBearerAuth({
        // The verifier is an object: the SDK calls `verifier.verifyAccessToken`.
        verifier: { verifyAccessToken: verifyMcpAccessToken },
        expectedResource: getMcpServerUrl(request),
        // The challenge points the client at the discovery document, which
        // names the authorization server.
        resourceMetadataUrl: new URL(
            "/.well-known/oauth-protected-resource/api/mcp",
            request.url,
        ).toString(),
    });
    const auth = await gate(request);
    if (auth instanceof Response) return auth;
    return handler.fetch(request, { authInfo: auth });
}
