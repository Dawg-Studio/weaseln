import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

import prisma from "@/db";
import { JSONContent } from "@tiptap/react";
import { Prisma } from "@prisma/client";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";
import { postContainerInclude } from "@/utils/prismaQuery";
import { rankContentForUser } from "@/utils/services/ranking";
import { buildWhere, buildOrderBy, paginate, ListPostsParams } from "./_query";
//Promise<any> is a temporary fix

export async function GET(req: NextRequest): Promise<any> {
    try {
        const url = new URL(req.url);
        const params: ListPostsParams = {
            keyword: url.searchParams.get("q")?.split(" ").join("&"),
            tag: url.searchParams.get("tag"),
            postId: url.searchParams.get("postId"),
            userId: url.searchParams.get("userId"),
            orgId: url.searchParams.get("orgId"),
            published: url.searchParams.get("published"),
            orderBy: url.searchParams.get("orderBy"),
            cursor: url.searchParams.get("cursor"),
        };

        const where = buildWhere(params);

        let orderBy:
            | Prisma.PostOrderByWithRelationInput
            | Prisma.PostOrderByWithRelationInput[];

        if (params.orderBy === "relevance") {
            const session = await auth();
            const ranked = await rankContentForUser(session?.user?.id, {
                postId: params.postId,
            });
            const interests = [
                ...new Set([...ranked.tags, ...ranked.titles, ...ranked.authors]),
            ]
                .map((interest) =>
                    interest.replace(/[\s\W]/g, "").toLowerCase(),
                )
                .toString()
                .split(",")
                .join("&");
            // ponytail: a brand-new user with no reading history produces an
            // empty interests string. Prisma's _relevance with empty search
            // returns zero rows, so the UI shows nothing. Fall back to the
            // default orderBy so the user actually sees posts.
            orderBy = interests
                ? [
                      {
                          _relevance: {
                              fields: ["tags", "title", "description", "author"],
                              search: interests,
                              sort: "desc",
                          },
                      },
                      { updatedAt: "desc" },
                  ]
                : buildOrderBy(params);
        } else {
            orderBy = buildOrderBy(params);
        }

        const result = await paginate(
            where,
            orderBy,
            postContainerInclude,
            params.cursor,
            10,
        );

        return NextResponse.json({ data: result }, { status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<any> {
    const body = await req.formData();
    const image_total = body.get("image_total")
        ? (body.get("image_total") as unknown as number)
        : (0 as number);
    const images = () => {
        const imageFiles: FormDataEntryValue[] = [];
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
    //create titleId for the Url
    function generateRandomCode(): string {
        return randomBytes(2).toString("base64url").slice(0, 4);
    }
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
        const orgId = body.get("orgId") as string;
        const post = await prisma.post.upsert({
            where: { id: (body.get("postId") as string) ?? "" },
            update: {
                title: (body.get("title") as string).trim(),
                description: (body.get("description") as string).trim(),
                tags: [...JSON.parse(body.get("tags") as string)],
                content: JSON.parse(body.get("content") as string),
                readPerMinute: parseInt(body.get("readPerMinute") as string),
                published:
                    (body.get("published") as string) === "true" ? true : false,
            },
            create: {
                title: (body.get("title") as string).trim(),
                titleId: `${(body.get("title") as string)
                    .replace(/[^a-zA-Z0-9 ]/g, "")
                    .trim()
                    .split(" ")
                    .join("-")}-${generateRandomCode()}`,
                description: (body.get("description") as string).trim(),
                tags: [...JSON.parse(body.get("tags") as string)],
                content: JSON.parse(body.get("content") as string),
                readPerMinute: parseInt(body.get("readPerMinute") as string),
                authorUsername: body.get("username") as string,
                published:
                    (body.get("published") as string) === "true" ? true : false,
                user: {
                    connect: { id: session?.user.id },
                },
                ...(orgId && {
                    organization: {
                        connect: { id: orgId },
                    },
                }),
            },
            select: {
                id: true,
                content: true,
                titleId: true,
            },
        });
        //deletes the draft if new post has been inserted completely
        if (post && image_total === 0 && body.get("coverImage") === "undefined")
            return NextResponse.json({ data: post.titleId }, { status: 200 }); //if no new images and cover images detected
        if (post && image_total > 0) {
            //only upload if images are detected in the content
            const content = post.content as JSONContent;
            const contentImages = content.content?.filter(
                (image) => image.type === "image",
            ) as JSONContent[];
            const uploaded: Array<Record<string, any>> = [];
            for (const [index, image] of Object.entries(images())) {
                const cloudinary = await uploadCloudinary({
                    file: image,
                    folder: "post",
                    public_id: `${post.id}_${index}`,
                });
                if (cloudinary.upload.ok) {
                    uploaded.push(cloudinary.metadata);
                }
            }
            if (uploaded) {
                if (
                    Object.keys(uploaded).length ===
                        Object.keys(images()).length &&
                    Object.keys(contentImages).length ===
                        Object.keys(uploaded).length
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
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        content: content,
                    },
                });
            }
        }
        if (post && body.get("coverImage")) {
            //upload coverImage
            const imgFile = body.get("coverImage");
            if (!imgFile) throw new Error("No file found");
            const cloudinary = await uploadCloudinary({
                file: imgFile,
                folder: "post",
                public_id: `${post.id}_cover`,
            });
            if (cloudinary.upload.ok) {
                const imageAddr = getCloudinaryImage({
                    timestamp: cloudinary.metadata.timestamp,
                    public_id: cloudinary.metadata.public_id,
                    folder: cloudinary.metadata.folder,
                });
                const coverImage = await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        coverImage: imageAddr, //always output coverImage of 1920 1080
                    },
                });
                if (coverImage) {
                    revalidatePath("/new", "page");
                    return NextResponse.json(
                        { data: post.titleId },
                        { status: 200 },
                    ); //return a response here since coverImage is REQUIRED.
                }
            }
        }
        if (post) {
            revalidatePath("/new", "page");
            return NextResponse.json({ data: post.titleId }, { status: 200 });
        }
    } catch (err) {
        console.log(err);
        return NextResponse.json({ err }, { status: 500 });
    }
}
