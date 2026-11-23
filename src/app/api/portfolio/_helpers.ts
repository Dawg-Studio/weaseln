import { NextResponse } from "next/server";

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * A validator throw is a 400 and is caught before this runs; what reaches here
 * is either "the predicate matched nothing" (404) or a real failure (500).
 */
export function errorResponse(scope: string, err: unknown) {
    if (err instanceof Error && /not found/i.test(err.message)) {
        return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(`${scope} failed`, err);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}

export async function readBody(
    req: Request,
): Promise<Record<string, unknown> | null> {
    try {
        const parsed: unknown = await req.json();
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function invalidMessage(err: unknown) {
    return err instanceof Error ? err.message : "Invalid input";
}
