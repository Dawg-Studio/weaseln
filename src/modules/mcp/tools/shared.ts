import type { AuthInfo } from "@modelcontextprotocol/server";

export type Caller = {
    userId: string;
    clientId: string;
    scopes: string[];
};

export type ToolContext = { http?: { authInfo?: AuthInfo } };

export type ScopeChallengeResult =
    | { scopes: [string, ...string[]]; errorDescription?: string }
    | undefined;

export type ScopeChallengeHandler = (_context: {
    request: { params?: unknown };
    authInfo?: AuthInfo;
}) => ScopeChallengeResult;

export type ToolResult = {
    content: { type: "text"; text: string }[];
    isError?: boolean;
};

/**
 * The caller comes from the verified token, never from an argument. A tool
 * that trusted an id in its input would let a token act as another account.
 */
export function callerOf(ctx: ToolContext): Caller {
    const authInfo = ctx.http?.authInfo;
    const userId = authInfo?.extra?.userId;
    if (typeof userId !== "string" || userId === "") {
        throw new Error("Not authorized");
    }
    return {
        userId,
        clientId: authInfo?.clientId ?? "",
        scopes: authInfo?.scopes ?? [],
    };
}

export function text(value: unknown): ToolResult {
    return {
        content: [
            {
                type: "text" as const,
                text:
                    typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2),
            },
        ],
    };
}

/**
 * A failed tool call reports what went wrong and nothing else. The detail
 * stays in the server log.
 */
export function toolError(error: unknown): ToolResult {
    const message =
        error instanceof Error ? error.message : "Something went wrong";
    return {
        content: [{ type: "text" as const, text: message }],
        isError: true,
    };
}
