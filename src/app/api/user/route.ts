import { NextResponse } from "next/server";

import prisma from "@/db";
import { auth } from "@/auth";
import { Prisma, User } from "@/generated/prisma/client";
import { ProfileError, updateOwnProfile } from "@/modules/profile/service";

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

    try {
        await updateOwnProfile({ userId: session.user.id }, body);
        return NextResponse.json({ status: 200 });
    } catch (err) {
        if (err instanceof ProfileError) {
            // The settings form reads `error.meta.target` to point at the
            // offending input, and `error` as a string for the toast.
            if (err.field) {
                return NextResponse.json(
                    {
                        error: {
                            message: err.message,
                            meta: { target: [err.field] },
                        },
                    },
                    { status: err.status },
                );
            }
            return NextResponse.json(
                { error: err.message },
                { status: err.status },
            );
        }
        console.error("profile PATCH failed", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
