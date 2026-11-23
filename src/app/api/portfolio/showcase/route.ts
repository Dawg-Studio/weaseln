import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
    createShowcase,
    deleteShowcase,
    moveShowcase,
    updateShowcase,
} from "@/modules/portfolio/service";
import { validateShowcaseInput } from "@/modules/portfolio/validation";
import {
    badRequest,
    errorResponse,
    invalidMessage,
    readBody,
    unauthorized,
} from "../_helpers";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    let input;
    try {
        input = validateShowcaseInput(body);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        const created = await createShowcase(
            { userId: session.user.id },
            input,
        );
        return NextResponse.json(created, { status: 201 });
    } catch (err) {
        return errorResponse("portfolio showcase POST", err);
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { showcaseId, direction, ...rest } = body;
    if (typeof showcaseId !== "string") {
        return badRequest("showcaseId is required");
    }

    if (direction !== undefined) {
        if (direction !== 1 && direction !== -1) {
            return badRequest("direction must be 1 or -1");
        }
        try {
            await moveShowcase(
                { userId: session.user.id },
                { showcaseId, direction },
            );
            return NextResponse.json({ status: 200 });
        } catch (err) {
            return errorResponse("portfolio showcase move", err);
        }
    }

    let input;
    try {
        input = validateShowcaseInput(rest);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        await updateShowcase(
            { userId: session.user.id },
            { showcaseId, ...input },
        );
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio showcase PATCH", err);
    }
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { showcaseId } = body;
    if (typeof showcaseId !== "string") {
        return badRequest("showcaseId is required");
    }

    try {
        await deleteShowcase({ userId: session.user.id }, { showcaseId });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio showcase DELETE", err);
    }
}
