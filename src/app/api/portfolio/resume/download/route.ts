import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getResumeDownloadUrl } from "@/modules/portfolio/resume";
import { badRequest, errorResponse } from "../../_helpers";

export async function GET(req: Request) {
    const session = await auth();
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return badRequest("userId is required");

    try {
        const url = await getResumeDownloadUrl(
            session?.user ? { userId: session.user.id } : null,
            { userId },
        );
        if (!url) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.redirect(url, 302);
    } catch (err) {
        return errorResponse("portfolio resume download", err);
    }
}
