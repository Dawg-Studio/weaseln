import prisma from "@/db";
import { JSONContent } from "@tiptap/react";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";

export async function POST(req: NextRequest): Promise<any> {
    const body = await req.formData();
    const image_total = body.get("image_total")
        ? (body.get("image_total") as unknown as number)
        : (0 as number);
    const images = () => {
        let imageFiles: FormDataEntryValue[] = [];
        if (image_total > 0) {
            for (let i = 0; i < image_total; i++) {
                const image = body.get(`image_${i}`);
                if (image) {
                    imageFiles.push(image);
                }
            }
        }
        return imageFiles;
    };
    try {
        const session = await auth();
        const pastDraft = await prisma.user.findUnique({
            where: { id: session?.user.id },
            select: {
                draft: true,
            },
        });
        if (pastDraft?.draft) {
            await prisma.postDraft.delete({
                where: {
                    userId: session?.user.id,
                },
            });
        }
        const userDraftUpdate = await prisma.user.update({
            where: { id: session?.user.id },
            data: {
                draft: {
                    connectOrCreate: {
                        where: {
                            userId: session?.user.id,
                        },
                        create: {
                            title: (body.get("title") as string).trim(),
                            description: (
                                body.get("description") as string
                            ).trim(),
                            tags: [...JSON.parse(body.get("tags") as string)],
                            content: JSON.parse(body.get("content") as string),
                        },
                    },
                },
            },
            select: {
                draft: true,
            },
        });
        const draft = userDraftUpdate.draft;
        if (
            draft &&
            image_total === 0 &&
            body.get("coverImage") === "undefined"
        )
            return NextResponse.json({ status: 200 }); //if no new images and cover images detected
        if (draft && image_total > 0) {
            //only upload if images are detected in the content
            const content = draft.content as JSONContent;
            const contentImages = content.content?.filter(
                (image) => image.type === "image",
            ) as JSONContent[];
            let uploaded: Array<Record<string, any>> = [];
            for (const [index, image] of Object.entries(images())) {
                const cloudinary = await uploadCloudinary({
                    file: image,
                    folder: "post",
                    public_id: `${draft.id}_${index}`,
                });
                if (cloudinary.upload.ok) {
                    uploaded.push(cloudinary.metadata);
                }
            }
            if (uploaded) {
                if (
                    Object.keys(uploaded as unknown as string).length ===
                        Object.keys(images()).length &&
                    Object.keys(contentImages).length ===
                        Object.keys(uploaded as unknown as string).length
                ) {
                    if (contentImages) {
                        for (const [index, image] of Object.entries(
                            contentImages,
                        )) {
                            const imageAddr = getCloudinaryImage({
                                timestamp: uploaded[parseInt(index)].timestamp,
                                folder: uploaded[parseInt(index)].folder,
                                public_id: uploaded[parseInt(index)].public_id,
                            });
                            if (!image.attrs?.src) return;
                            image.attrs.src = imageAddr;
                        }
                    }
                }
                await prisma.postDraft.update({
                    where: {
                        userId: session?.user.id,
                    },
                    data: {
                        content: content,
                    },
                });
            }
        }
        if (draft && body.get("coverImage")) {
            const cloudinary = await uploadCloudinary({
                file: body.get("coverImage") as File,
                folder: "zefer/post/draft",
                public_id: `${draft.id}_cover`,
            });
            if (cloudinary.upload.ok) {
                await prisma.postDraft.update({
                    where: { userId: session?.user.id },
                    data: {
                        coverImage: `https://res.cloudinary.com/leindfraust/image/upload/w_1920,h_1080,c_scale/v${cloudinary.metadata.timestamp}/${cloudinary.metadata.folder}/${draft.id}_cover.jpg`, //always output coverImage of 1920 1080
                    },
                });
                return NextResponse.json({ status: 200 }); //return a response here since coverImage is REQUIRED.
            }
        }
        if (draft) return NextResponse.json({ status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}
