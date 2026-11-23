import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
    createExperience,
    deleteExperience,
    moveExperience,
    updateExperience,
} from "@/modules/portfolio/service";
import { validateExperienceInput } from "@/modules/portfolio/validation";
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
        input = validateExperienceInput(body);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        const created = await createExperience(
            { userId: session.user.id },
            input,
        );
        return NextResponse.json(created, { status: 201 });
    } catch (err) {
        return errorResponse("portfolio experience POST", err);
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { experienceId, direction, ...rest } = body;
    if (typeof experienceId !== "string") {
        return badRequest("experienceId is required");
    }

    // Reordering rides on the same endpoint: one id and a direction, no body.
    if (direction !== undefined) {
        if (direction !== 1 && direction !== -1) {
            return badRequest("direction must be 1 or -1");
        }
        try {
            await moveExperience(
                { userId: session.user.id },
                { experienceId, direction },
            );
            return NextResponse.json({ status: 200 });
        } catch (err) {
            return errorResponse("portfolio experience move", err);
        }
    }

    let input;
    try {
        input = validateExperienceInput(rest);
    } catch (err) {
        return badRequest(invalidMessage(err));
    }

    try {
        await updateExperience(
            { userId: session.user.id },
            { experienceId, ...input },
        );
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio experience PATCH", err);
    }
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    const { experienceId } = body;
    if (typeof experienceId !== "string") {
        return badRequest("experienceId is required");
    }

    try {
        await deleteExperience({ userId: session.user.id }, { experienceId });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio experience DELETE", err);
    }
}
