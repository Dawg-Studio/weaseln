import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ImageUploadError, uploadImage } from "@/modules/images/service";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.formData();
    const img = body.get("imgFile");
    if (!img || typeof img === "string") {
        return NextResponse.json(
            { error: "No image file found" },
            { status: 400 },
        );
    }

    try {
        const bytes = Buffer.from(await img.arrayBuffer());
        const { url } = await uploadImage(
            { userId: session.user.id },
            {
                data: bytes.toString("base64"),
                filename: img.name,
                purpose: "post_background",
                mimeType: img.type,
            },
        );
        return NextResponse.json({ url }, { status: 200 });
    } catch (err) {
        if (err instanceof ImageUploadError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.status },
            );
        }
        console.error("background upload failed", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
