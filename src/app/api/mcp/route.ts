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
 * A base64 image is a third larger than the image, and a full size resume
 * PDF is 5 MiB, so the body has to hold 7 MiB of base64 plus the envelope.
 * The app's own cap sits above the platform's: a Vercel function refuses a
 * body over 4.5 MB, so there the ceiling is lower and this is not the
 * bottleneck.
 */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

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
