import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";

/**
 * ponytail: this route used to hand any file, of any size, from any signed-in
 * user straight to Cloudinary. The three checks below all run BEFORE that call
 * so a rejected upload never leaves the process.
 */
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MiB

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * The Content-Type on a multipart part is whatever the client claims, so a
 * renamed .exe arrives labelled `image/png`. Read the leading bytes and require
 * them to spell one of the formats we accept.
 */
function sniffImageFormat(header: Uint8Array): "png" | "jpeg" | "webp" | null {
    const matches = (offset: number, ...bytes: number[]) =>
        bytes.every((byte, index) => header[offset + index] === byte);

    // 89 "PNG" CR LF SUB LF
    if (matches(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
        return "png";
    // SOI followed by the first marker.
    if (matches(0, 0xff, 0xd8, 0xff)) return "jpeg";
    // "RIFF", four bytes of chunk length, then "WEBP".
    if (
        matches(0, 0x52, 0x49, 0x46, 0x46) &&
        matches(8, 0x57, 0x45, 0x42, 0x50)
    ) {
        return "webp";
    }
    return null;
}

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

    if (img.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
            { error: "Image must be 3 MiB or smaller" },
            { status: 413 },
        );
    }

    if (!ALLOWED_MIME_TYPES.includes(img.type)) {
        return NextResponse.json(
            { error: "Image must be a PNG, JPEG or WebP" },
            { status: 415 },
        );
    }

    // Twelve bytes is every signature we test: PNG needs 8, JPEG 3, and WebP
    // reads "WEBP" at offset 8.
    const header = new Uint8Array(await img.slice(0, 12).arrayBuffer());
    if (!sniffImageFormat(header)) {
        return NextResponse.json(
            { error: "File contents are not a PNG, JPEG or WebP image" },
            { status: 415 },
        );
    }

    try {
        const cloudinary = await uploadCloudinary({
            file: img,
            folder: "background",
            public_id: `${session.user.id}-${Date.now()}`,
        });
        if (cloudinary.upload.ok) {
            const url = getCloudinaryImage({
                timestamp: cloudinary.metadata.timestamp,
                public_id: cloudinary.metadata.public_id,
                folder: cloudinary.metadata.folder,
            });
            return NextResponse.json({ url }, { status: 200 });
        }
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    } catch (err) {
        console.error("background upload failed", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
