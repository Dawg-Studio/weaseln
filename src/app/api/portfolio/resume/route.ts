import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
    assertResumeBytes,
    removeResume,
    ResumeError,
    setResumeVisibility,
    uploadResume,
} from "@/modules/portfolio/resume";
import {
    MAX_RESUME_BYTES,
    MULTIPART_ENVELOPE_BYTES,
} from "@/modules/portfolio/types";
import {
    badRequest,
    errorResponse,
    readBody,
    unauthorized,
} from "../_helpers";

function resumeErrorResponse(err: unknown) {
    if (err instanceof ResumeError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return errorResponse("portfolio resume", err);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    // Checked before the body is parsed: formData() reads the whole request
    // into memory, so an oversized upload has to be refused before that.
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_RESUME_BYTES + MULTIPART_ENVELOPE_BYTES) {
        return NextResponse.json(
            { error: "Resume must be 5 MiB or smaller" },
            { status: 413 },
        );
    }

    const form = await req.formData();
    const file = form.get("resume");
    if (!(file instanceof File)) return badRequest("No resume file found");

    // The cap is checked on the declared size, before the bytes are copied
    // into memory. Reading first would hold the file twice.
    if (file.size > MAX_RESUME_BYTES) {
        return NextResponse.json(
            { error: "Resume must be 5 MiB or smaller" },
            { status: 413 },
        );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Checked here as well as in the service, so a bad file is a 415 before
    // anything is uploaded.
    try {
        assertResumeBytes(bytes, file.type || undefined);
    } catch (err) {
        if (err instanceof ResumeError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.status },
            );
        }
        return badRequest("Invalid resume");
    }

    try {
        const result = await uploadResume({ userId: session.user.id }, { bytes });
        return NextResponse.json(result, { status: result.error ? 422 : 201 });
    } catch (err) {
        return resumeErrorResponse(err);
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await readBody(req);
    if (!body) return badRequest("Expected an object body");
    if (typeof body.isPublic !== "boolean") {
        return badRequest("isPublic must be a boolean");
    }

    try {
        await setResumeVisibility(
            { userId: session.user.id },
            { isPublic: body.isPublic },
        );
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return errorResponse("portfolio resume PATCH", err);
    }
}

export async function DELETE() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        await removeResume({ userId: session.user.id });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        return resumeErrorResponse(err);
    }
}
