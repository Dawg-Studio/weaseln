import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createItem, deleteItem, moveItem, updateItem } from "@/modules/portfolio/service";
import { validateItemInput } from "@/modules/portfolio/validation";
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

    const { showcaseId, ...rest } = body;
    if (typeof showcaseId !== "string") {
        return badRequest("showcaseId is required");
    }

    let input;
    try {
        input = validateItemInput(rest);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        const created = await createItem(
            { userId: session.user.id },
            { showcaseId, ...input },
        );
        return NextResponse.json(created, { status: 201 });
    } catch (err) {
        return errorResponse("portfolio item POST", err);
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { itemId, direction, ...rest } = body;
    if (typeof itemId !== "string") {
        return badRequest("itemId is required");
    }

    if (direction !== undefined) {
        if (direction !== 1 && direction !== -1) {
            return badRequest("direction must be 1 or -1");
        }
        try {
            await moveItem({ userId: session.user.id }, { itemId, direction });
            return NextResponse.json({ status: 200 });
        } catch (err) {
            return errorResponse("portfolio item move", err);
        }
    }

    let input;
    try {
        input = validateItemInput(rest);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        await updateItem({ userId: session.user.id }, { itemId, ...input });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio item PATCH", err);
    }
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { itemId } = body;
    if (typeof itemId !== "string") {
        return badRequest("itemId is required");
    }

    try {
        await deleteItem({ userId: session.user.id }, { itemId });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio item DELETE", err);
    }
}
