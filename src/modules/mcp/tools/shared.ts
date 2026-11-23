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
 * The errors a caller caused are named; the errors we caused are not. An
 * internal failure is logged and reported as a plain failure, so a database
 * error or a Prisma invocation does not reach the caller.
 */
const CALLER_ERROR_MESSAGES = new Set([
    "Not authorized",
    "Post not found",
    "Organization not found",
    "Username already taken",
]);

/**
 * The prefixes the validators and the tools use for a mistake the caller
 * made. The list is explicit on purpose: an error that is not on it is
 * treated as ours and is not returned.
 */
const CALLER_ERROR_PREFIXES = [
    "Invalid post customization",
    "Invalid profile customization",
    "No user named ",
    "You do not belong",
    "This post contains ",
];

function isCallerError(message: string): boolean {
    return (
        CALLER_ERROR_MESSAGES.has(message) ||
        CALLER_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))
    );
}

/**
 * A failed tool call reports what went wrong and nothing else. The detail
 * stays in the server log.
 */
export function toolError(error: unknown): ToolResult {
    const message = error instanceof Error ? error.message : "";
    if (!isCallerError(message)) {
        console.error("MCP tool failed", error);
        return {
            content: [{ type: "text", text: "Internal server error" }],
            isError: true,
        };
    }
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
