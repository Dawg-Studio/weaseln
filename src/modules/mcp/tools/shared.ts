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
    "Showcase not found",
    "Item not found",
    "Experience not found",
]);

/**
 * The prefixes the validators and the tools use for a mistake the caller
 * made. The list is explicit on purpose: an error that is not on it is
 * treated as ours and is not returned.
 */
const CALLER_ERROR_PREFIXES = [
    "Invalid post customization",
    "Invalid profile customization",
    "Invalid portfolio input",
    "No user named ",
    "You do not belong",
    "This post contains ",
];

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : "";
}

/**
 * The status of an error says who owns it: a 4xx is the caller's mistake and
 * a 5xx is ours.
 */
function hasCallerStatus(error: unknown): error is Error & { status: number } {
    // Only an Error is read: only an Error carries a message we can report.
    if (!(error instanceof Error) || !("status" in error)) {
        return false;
    }
    return typeof error.status === "number";
}

function isCallerError(error: unknown): boolean {
    const message = messageOf(error);
    if (hasCallerStatus(error)) {
        // A server failure stays internal whatever its message says, and a
        // caller error with no message has nothing worth reporting.
        if (error.status >= 500) {
            return false;
        }
        if (error.status >= 400) {
            return message !== "";
        }
    }
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
    const message = messageOf(error);
    if (!isCallerError(error)) {
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
