import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
    ImageUploadError,
    MAX_UPLOAD_BYTES,
    uploadImage,
} from "@/modules/images/service";
import { badRequest, unauthorized } from "../_helpers";
import { MULTIPART_ENVELOPE_BYTES } from "@/modules/portfolio/types";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    // Checked before the body is parsed: formData() reads the whole request
    // into memory, so an oversized upload has to be refused before that.
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_UPLOAD_BYTES + MULTIPART_ENVELOPE_BYTES) {
        return NextResponse.json(
            { error: "Image must be 3 MiB or smaller" },
            { status: 413 },
        );
    }

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return badRequest("No image file found");

    // Checked on the declared size, before the bytes are copied into memory.
    if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
            { error: "Image must be 3 MiB or smaller" },
            { status: 413 },
        );
    }

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    try {
        const uploaded = await uploadImage(
            { userId: session.user.id },
            {
                data,
                filename: file.name,
                purpose: "portfolio",
                mimeType: file.type || undefined,
            },
        );
        return NextResponse.json(uploaded, { status: 201 });
    } catch (err) {
        if (err instanceof ImageUploadError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.status },
            );
        }
        console.error("portfolio image POST failed", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
