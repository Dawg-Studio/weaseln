import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

import prisma from "@/db";
import { JSONContent } from "@tiptap/react";
import { Prisma } from "@/generated/prisma/client";
import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";
import { postContainerInclude } from "@/utils/prismaQuery";
import { rankContentForUser } from "@/utils/services/ranking";
import type { PostCustomization } from "@/modules/post-customization/types";
import { validatePostCustomizationInput } from "@/modules/post-customization/validation";
import { buildWhere, buildOrderBy, paginate, ListPostsParams } from "./_query";
//Promise<any> is a temporary fix

export async function GET(req: NextRequest) {
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
                ...new Set([
                    ...ranked.tags,
                    ...ranked.titles,
                    ...ranked.authors,
                ]),
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
                              fields: [
                                  "tags",
                                  "title",
                                  "description",
                                  "author",
                              ],
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

type CustomizationResult =
    | { ok: true; data: Partial<PostCustomization> }
    | { ok: false; message: string };

/**
 * ponytail: the composer sends the picked background as a JSON string in a
 * `customization` FormData field. An absent field yields `{}` on purpose — the
 * spread then contributes nothing, so an older client writes exactly the row it
 * wrote before this feature existed and an existing post keeps the background
 * it already has. Anything present but unsupported is a loud 400 rather than a
 * silent default.
 */
function readCustomization(body: FormData): CustomizationResult {
    const field = body.get("customization");
    // The composer stringifies optional fields, so an unset one arrives as the
    // literal "undefined" — same idiom as the coverImage check further down.
    if (
        typeof field !== "string" ||
        field.trim() === "" ||
        field === "undefined"
    ) {
        return { ok: true, data: {} };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(field);
    } catch {
        return {
            ok: false,
            message: "Invalid post customization: payload is not valid JSON",
        };
    }
    try {
        return { ok: true, data: validatePostCustomizationInput(parsed) };
    } catch (err) {
        return {
            ok: false,
            message:
                err instanceof Error
                    ? err.message
                    : "Invalid post customization",
        };
    }
}

export async function POST(req: NextRequest) {
    // ponytail: this guard must precede req.formData(). Parsing first makes
    // the server buffer an arbitrarily large multipart body on behalf of a
    // caller we are about to reject, which turns the publish endpoint into an
    // unauthenticated upload sink. Resolve the session first, reject, and
    // only then read the body.
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
        // ponytail: the upsert below keys on a caller-supplied postId and
        // carried no author scope, so any signed-in user could rewrite any post
        // by id. Resolve the row first and refuse when it belongs to somebody
        // else. A postId that matches nothing still falls through to `create`,
        // exactly as it did before.
        const postId = (body.get("postId") as string) ?? "";
        if (postId) {
            const existing = await prisma.post.findUnique({
                where: { id: postId },
                select: { userId: true },
            });
            if (existing && existing.userId !== session.user.id) {
                return NextResponse.json(
                    { error: "Forbidden" },
                    { status: 403 },
                );
            }
        }
        const customization = readCustomization(body);
        if (!customization.ok) {
            return NextResponse.json(
                { error: customization.message },
                { status: 400 },
            );
        }
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
            where: { id: postId },
            update: {
                title: (body.get("title") as string).trim(),
                description: (body.get("description") as string).trim(),
                tags: [...JSON.parse(body.get("tags") as string)],
                content: JSON.parse(body.get("content") as string),
                readPerMinute: parseInt(body.get("readPerMinute") as string),
                published:
                    (body.get("published") as string) === "true" ? true : false,
                ...customization.data,
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
                ...customization.data,
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
            const coverField = body.get("coverImage");
            if (!coverField) throw new Error("No file found");
            // ponytail: when QA_NO_COVER is set, the client sends a placeholder
            // local URL as a string instead of a File. Store it directly so the
            // QA run can exercise publish without a Cloudinary round trip.
            const coverIsUrl =
                typeof coverField === "string" &&
                (coverField.startsWith("/covers/") ||
                    coverField.startsWith("http"));
            if (coverIsUrl) {
                const coverImage = await prisma.post.update({
                    where: { id: post.id },
                    data: { coverImage: coverField as string },
                });
                if (coverImage) {
                    revalidatePath("/new", "page");
                    return NextResponse.json(
                        { data: post.titleId },
                        { status: 200 },
                    );
                }
            } else {
                const cloudinary = await uploadCloudinary({
                    file: coverField,
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
