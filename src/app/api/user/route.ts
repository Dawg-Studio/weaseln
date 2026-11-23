import { NextResponse } from "next/server";

import prisma from "@/db";
import { auth } from "@/auth";
import { Prisma, User } from "@/generated/prisma/client";

const PER_PAGE = 20;

//Promise<any> is a temporary fix
export async function GET(req: Request) {
    const url = new URL(req.url);
    const lastCursor = url.searchParams.get("cursor");
    const keyword = url.searchParams.get("q")?.split(" ").join("&");

    const where: Prisma.UserWhereInput = {};
    if (keyword) {
        where.OR = [
            { name:       { search: keyword } },
            { username:   { search: keyword } },
            { email:      { search: keyword } },
            { bio:        { search: keyword } },
            { address:    { search: keyword } },
            { occupation: { search: keyword } },
        ];
    }

    try {
        const users = await prisma.user.findMany({
            where,
            ...(lastCursor && {
                skip: 1,
                cursor: {
                    id: lastCursor,
                },
            }),
            take: PER_PAGE + 1,
        });

        if (users.length === 0) {
            return NextResponse.json(
                {
                    data: [],
                    metaData: {
                        lastCursor: null,
                        hasNextPost: false,
                    },
                },
                { status: 200 },
            );
        }

        const hasNextPost = users.length > PER_PAGE;
        const page = hasNextPost ? users.slice(0, PER_PAGE) : users;
        const lastUser: User = page[page.length - 1];
        const cursor: string = lastUser.id;

        const data = {
            data: page,
            metaData: {
                lastCursor: cursor ?? null,
                hasNextPost,
            },
        };

        return NextResponse.json({ data }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ err }, { status: 500 });
    }
}

/**
 * The fields a caller may set on their own account. Spreading the request body
 * into Prisma lets a caller write any column, and the profile renders
 * `resumeUrl` as an href — `javascript:` would be a link on a public page.
 * Resume fields and `skills` are written only by the portfolio service.
 */
const USER_PATCH_FIELDS = [
    "username",
    "name",
    "bio",
    "address",
    "occupation",
    "email",
    "socials",
    "image",
] as const;

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        const parsed: unknown = await req.json();
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return NextResponse.json(
                { error: "Expected an object body" },
                { status: 400 },
            );
        }
        body = parsed as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const unsupported = Object.keys(body).filter(
        (key) => !(USER_PATCH_FIELDS as readonly string[]).includes(key),
    );
    if (unsupported.length > 0) {
        return NextResponse.json(
            { error: `Unsupported field: ${unsupported[0]}` },
            { status: 400 },
        );
    }

    const data = Object.fromEntries(
        USER_PATCH_FIELDS.filter((field) => field in body).map((field) => [
            field,
            body[field],
        ]),
    ) as Prisma.UserUpdateInput;

    if (typeof body.username === "string") {
        data.username = body.username.replace(/\s/g, "");
    }

    // Socials are merged by name rather than replaced: a link the caller did
    // not send is kept. A resume adds links to this column, and a form that
    // only knows three of them must not delete the rest.
    if (Array.isArray(body.socials)) {
        const malformed = body.socials.some(
            (entry) =>
                !entry ||
                typeof entry !== "object" ||
                typeof (entry as { name?: unknown }).name !== "string",
        );
        if (malformed) {
            return NextResponse.json(
                { error: "socials must be a list of { name, url } objects" },
                { status: 400 },
            );
        }
    }

    try {
        if (Array.isArray(body.socials)) {
            const current = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { socials: true },
            });
            const sent = body.socials as { name: string; url?: string }[];
            const sentNames = new Set(sent.map((entry) => entry.name));
            const existing = Array.isArray(current?.socials)
                ? (current.socials as { name?: string; url?: string }[])
                : [];
            data.socials = [
                ...sent,
                ...existing.filter(
                    (entry) => !sentNames.has(entry.name ?? ""),
                ),
            ] as Prisma.InputJsonValue[];
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data,
        });
        await prisma.post.updateMany({
            where: { userId: session.user.id },
            data: {
                author: typeof body.name === "string" ? body.name : undefined,
                authorUsername:
                    typeof body.username === "string"
                        ? body.username.replace(/\s/g, "")
                        : session.user.id,
            },
        });
        return NextResponse.json({ status: 200 });
    } catch (err) {
        console.log(err);
        return NextResponse.json({ error: err }, { status: 500 });
    }
}
