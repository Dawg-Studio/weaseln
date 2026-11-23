import { McpServer, type AuthInfo } from "@modelcontextprotocol/server";

import { registerIdentityTools } from "@/modules/mcp/tools/identity";
import { registerPostTools } from "@/modules/mcp/tools/posts";

/**
 * The MCP server for one caller. The tools are added in the tasks that own
 * them; this is the place they are wired together.
 */
export function buildServer(_authInfo: AuthInfo | undefined): McpServer {
    const server = new McpServer(
        { name: "weaseln", version: "1.0.0" },
        { capabilities: { tools: {} } },
    );
    registerIdentityTools(server);
    registerPostTools(server);
    return server;
}
