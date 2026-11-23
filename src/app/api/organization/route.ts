import { randomInt } from "crypto";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
    assertOrganizationOwner,
    createOrganization,
    updateOrganization,
} from "@/modules/organization/service";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.formData();
    const img = body.get("imgFile");
    const json = JSON.parse(body.get("json") as string);
    const { name, username, summary, socials } = json;
    try {
        if (!img) throw new Error("No image file found");
        const cloudinary = await uploadCloudinary({
            file: img,
            folder: "organization",
            public_id: `${session.user.id}_${
                    username ??
                    name.replace(/\s/g, "").toLowerCase() +
                    randomInt(1000, 10000)
            }`,
        });
        if (cloudinary.upload.ok) {
            const imageAddr = getCloudinaryImage({
                timestamp: cloudinary.metadata.timestamp,
                public_id: cloudinary.metadata.public_id,
                folder: cloudinary.metadata.folder,
            });
            const organization = await createOrganization(
                { userId: session.user.id },
                {
                    name,
                    username,
                    summary,
                    socials,
                    imageUrl: imageAddr,
                },
            );
            return NextResponse.json({ data: organization }, { status: 200 });
        }
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.formData();
    const img = body.get("imgFile");
    const json = JSON.parse(body.get("json") as string);
    const { id, name, username, summary, socials } = json;
    try {
        // The ownership is checked before the image is uploaded, so an
        // account with no claim to this organization cannot make the route
        // store assets for it.
        await assertOrganizationOwner(
            { userId: session.user.id },
            id,
        );
        let imageUrl: string | undefined;
        if (img) {
            const cloudinary = await uploadCloudinary({
                file: img,
                folder: "organization",
                public_id: `${session.user.id}_${
                        username ??
                        name.replace(/\s/g, "").toLowerCase() +
                            randomInt(1000, 10000)
                }`,
            });
            if (cloudinary.upload.ok) {
                imageUrl = getCloudinaryImage({
                    timestamp: cloudinary.metadata.timestamp,
                    public_id: cloudinary.metadata.public_id,
                    folder: cloudinary.metadata.folder,
                });
            }
        }
        const organization = await updateOrganization(
            { userId: session.user.id },
            {
                organizationId: id,
                name,
                username,
                summary,
                socials,
                ...(imageUrl && { imageUrl }),
            },
        );
        return NextResponse.json({ data: organization }, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message === "Not authorized") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.log(error);
        return NextResponse.json({ error }, { status: 500 });
    }
}
