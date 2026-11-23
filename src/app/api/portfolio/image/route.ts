import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
    ImageUploadError,
    uploadImage,
} from "@/modules/images/service";
import { badRequest, unauthorized } from "../_helpers";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return badRequest("No image file found");

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
