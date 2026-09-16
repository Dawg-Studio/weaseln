import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAudioForPost, getAudioStatus } from "@/modules/tts/service";
import { TTS_LIMITS } from "@/modules/tts/limits";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const postId = url.searchParams.get("postId") ?? url.searchParams.get("id");
        if (!postId) return NextResponse.json({ code: "BAD_REQUEST", message: "postId is required" }, { status: 400 });

        const status = await getAudioStatus(postId);
        if (!status) return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });

        // Public read: no auth required to check if audio exists. Surface states clearly.
        return NextResponse.json(
            {
                data: {
                    postId: status.id,
                    audioUrl: status.audioUrl,
                    audioStatus: status.audioStatus,
                    audioProvider: status.audioProvider,
                    audioGeneratedAt: status.audioGeneratedAt,
                    audioDurationMs: status.audioDurationMs,
                    audioError: status.audioError,
                    limits: {
                        maxChars: TTS_LIMITS.maxChars,
                        maxDurationMs: TTS_LIMITS.maxDurationMs,
                    },
                },
            },
            { status: 200 },
        );
    } catch (err) {
        console.error("[audio GET]", err);
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch audio status" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in to generate audio." }, { status: 401 });
        }

        let body: { postId?: string; force?: boolean };
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
            body = await req.json();
        } else {
            // Support form submissions as fallback
            const form = await req.formData();
            body = {
                postId: (form.get("postId") as string) ?? undefined,
                force: form.get("force") === "true",
            };
        }

        const postId = body?.postId?.trim();
        if (!postId) return NextResponse.json({ code: "BAD_REQUEST", message: "postId is required" }, { status: 400 });

        const result = await generateAudioForPost({ postId, userId: session.user.id, force: !!body.force });

        if (!result.ok) {
            return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
        }

        return NextResponse.json(
            {
                data: {
                    audioUrl: result.audioUrl,
                    provider: result.provider,
                    durationMs: result.durationMs,
                    cached: result.cached,
                },
            },
            { status: 200 },
        );
    } catch (err) {
        console.error("[audio POST]", err);
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Unexpected error during audio generation" }, { status: 500 });
    }
}
