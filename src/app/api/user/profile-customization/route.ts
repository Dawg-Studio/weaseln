import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    getProfileCustomization,
    resetProfileCustomization,
    setProfileCustomization,
} from "@/modules/profile-customization/service";
import { validateProfileCustomizationInput } from "@/modules/profile-customization/validation";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const customization = await getProfileCustomization({
        userId: session.user.id,
    });
    return NextResponse.json(customization, { status: 200 });
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

    // The request is checked on its own so an invalid field is a 400 before
    // anything is read or written.
    try {
        validateProfileCustomizationInput(body);
    } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Invalid input");
    }

    try {
        const saved = await setProfileCustomization(
            { userId: session.user.id },
            body,
        );
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
        const saved = await resetProfileCustomization({
            userId: session.user.id,
        });
        return NextResponse.json(saved, { status: 200 });
    } catch (err) {
        console.error("profile-customization DELETE failed", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
