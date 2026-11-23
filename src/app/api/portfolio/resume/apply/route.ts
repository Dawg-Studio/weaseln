import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { applyResumeProposal } from "@/modules/portfolio/resume";
import { badRequest, errorResponse, readBody, unauthorized } from "../../_helpers";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");

    try {
        const applied = await applyResumeProposal(
            { userId: session.user.id },
            body,
        );
        return NextResponse.json(applied, { status: 201 });
    } catch (err) {
        if (err instanceof Error && /^Invalid portfolio input/.test(err.message)) {
            return badRequest(err.message);
        }
        return errorResponse("portfolio resume apply", err);
    }
}
