import { NextResponse } from "next/server";

import prisma from "@/db";
import { auth } from "@/auth";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";
//Promise<any> is a temporary fix
export async function POST(req: Request): Promise<any> {
    const body = await req.formData();
    const img = body.get("imgFile");
    const session = await auth();

    try {
        if (!img) throw new Error("No image file found");
        const cloudinary = await uploadCloudinary({
            file: img,
            folder: "user",
            public_id: session?.user.id,
        });
        if (cloudinary.upload.ok) {
            const image = getCloudinaryImage({
                timestamp: cloudinary.metadata.timestamp,
                public_id: cloudinary.metadata.public_id,
                folder: cloudinary.metadata.folder,
            });
            const updateImage = await prisma.user.update({
                where: { id: session?.user.id },
                data: {
                    image,
                },
            });
            if (updateImage) return NextResponse.json(cloudinary);
        }
    } catch (err) {
        return NextResponse.json({ error: err }, { status: 500 });
    }
}
