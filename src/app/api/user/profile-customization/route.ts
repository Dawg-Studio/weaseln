import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/db";
import {
    DEFAULT_PROFILE_CUSTOMIZATION,
    validateProfileCustomizationInput,
} from "@/modules/profile-customization/validation";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const row = await prisma.userProfileCustomization.findUnique({
        where: { userId: session.user.id },
    });
    if (!row) {
        return NextResponse.json(DEFAULT_PROFILE_CUSTOMIZATION, { status: 200 });
    }
    return NextResponse.json(row, { status: 200 });
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return badRequest("Invalid JSON body");
    }
    if (body === null || typeof body !== "object") {
        return badRequest("Expected an object body");
    }

    let next: ReturnType<typeof validateProfileCustomizationInput>;
    try {
        next = validateProfileCustomizationInput(body);
    } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Invalid input");
    }

    try {
        const saved = await prisma.userProfileCustomization.upsert({
            where: { userId: session.user.id },
            create: { userId: session.user.id, ...next },
            update: next,
        });
        return NextResponse.json(saved, { status: 200 });
    } catch (err) {
        console.error("profile-customization PATCH failed", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const saved = await prisma.userProfileCustomization.update({
            where: { userId: session.user.id },
            data: {
                preset: DEFAULT_PROFILE_CUSTOMIZATION.preset,
                layout: DEFAULT_PROFILE_CUSTOMIZATION.layout,
                backgroundColor: DEFAULT_PROFILE_CUSTOMIZATION.backgroundColor,
                backgroundImage: DEFAULT_PROFILE_CUSTOMIZATION.backgroundImage,
                backgroundSize: DEFAULT_PROFILE_CUSTOMIZATION.backgroundSize,
                backgroundPosition: DEFAULT_PROFILE_CUSTOMIZATION.backgroundPosition,
                backgroundOverlay: DEFAULT_PROFILE_CUSTOMIZATION.backgroundOverlay,
                pageGradient: DEFAULT_PROFILE_CUSTOMIZATION.pageGradient,
                cardColor: DEFAULT_PROFILE_CUSTOMIZATION.cardColor,
                cardOpacity: DEFAULT_PROFILE_CUSTOMIZATION.cardOpacity,
                cardRadius: DEFAULT_PROFILE_CUSTOMIZATION.cardRadius,
                cardShadow: DEFAULT_PROFILE_CUSTOMIZATION.cardShadow,
                borderStyle: DEFAULT_PROFILE_CUSTOMIZATION.borderStyle,
                textColor: DEFAULT_PROFILE_CUSTOMIZATION.textColor,
                mutedTextColor: DEFAULT_PROFILE_CUSTOMIZATION.mutedTextColor,
                accentColor: DEFAULT_PROFILE_CUSTOMIZATION.accentColor,
                fontFamily: DEFAULT_PROFILE_CUSTOMIZATION.fontFamily,
                headingSize: DEFAULT_PROFILE_CUSTOMIZATION.headingSize,
                textAlign: DEFAULT_PROFILE_CUSTOMIZATION.textAlign,
                spacingDensity: DEFAULT_PROFILE_CUSTOMIZATION.spacingDensity,
            },
        });
        return NextResponse.json(saved, { status: 200 });
    } catch (err) {
        console.error("profile-customization DELETE failed", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
