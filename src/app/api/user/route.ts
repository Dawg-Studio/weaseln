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

export async function PATCH(req: Request) {
    const body = await req.json();
    const session = await auth();
    try {
        const user = await prisma.user.update({
            where: { id: session?.user.id },
            data: {
                ...body,
                ...(body.username && {
                    username: body.username.replace(/\s/g, ""),
                }),
            },
        });
        const updatePosts = await prisma.post.updateMany({
            where: { userId: session?.user.id },
            data: {
                author: body.name,
                authorUsername: body.username
                    ? body.username.replace(/\s/g, "")
                    : session?.user.id,
            },
        });
        if (user && updatePosts) {
            return NextResponse.json({ status: 200 });
        }
    } catch (err) {
        console.log(err);
        return NextResponse.json({ error: err }, { status: 500 });
    }
}
