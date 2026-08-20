import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.formData();
    const img = body.get("imgFile");
    if (!img) {
        return NextResponse.json({ error: "No image file found" }, { status: 400 });
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
