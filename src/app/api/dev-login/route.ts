import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import prisma from "@/db";

// QA-only: bypass the magic-link email by writing the VerificationToken row
// directly and returning the callback URL. Gated by ENABLE_DEV_LOGIN so it
// never responds in environments where the flag isn't explicitly set.
// ponytail: one env-gated POST, no new auth provider.
export async function POST(req: Request) {
    if (process.env.ENABLE_DEV_LOGIN !== "true") {
        return NextResponse.json({ error: "disabled" }, { status: 404 });
    }

    let body: { email?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    if (!secret) {
        return NextResponse.json(
            { error: "AUTH_SECRET not set" },
            { status: 500 },
        );
    }

    const rawToken = randomBytes(32).toString("hex");
    const hashed = createHash("sha256")
        .update(`${rawToken}${secret}`)
        .digest("hex");
    await prisma.verificationToken.create({
        data: {
            identifier: email,
            token: hashed,
            expires: new Date(Date.now() + 15 * 60 * 1000),
        },
    });

    const origin = new URL(req.url).origin;
    const url = `${origin}/api/auth/callback/nodemailer?${new URLSearchParams({
        callbackUrl: `${origin}/`,
        token: rawToken,
        email,
    })}`;

    console.warn(`[dev-login] issued token for ${email}`);
    return NextResponse.json({ url });
}
