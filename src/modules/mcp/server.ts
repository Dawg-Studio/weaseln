import { McpServer, type AuthInfo } from "@modelcontextprotocol/server";

/**
 * The MCP server for one caller. The tools are added in the tasks that own
 * them; this is the place they are wired together.
 */
export function buildServer(_authInfo: AuthInfo | undefined): McpServer {
    return new McpServer(
        { name: "weaseln", version: "1.0.0" },
        { capabilities: { tools: {} } },
    );
}
