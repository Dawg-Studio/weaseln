import type { TtsProvider, TtsGenerateInput, TtsGenerateResult } from "../types";

/**
 * VoxCPM provider — HTTP adapter for a self-hosted OpenBMB VoxCPM inference
 * server. The server is expected to expose a POST endpoint that accepts JSON
 * { text, voice? } and returns raw audio bytes (wav/mp3) or JSON { audio: base64 }.
 *
 * Environment:
 *  - VOXCPM_API_URL  e.g. http://localhost:8000/synthesize
 *  - VOXCPM_API_KEY  optional Bearer token
 *  - VOXCPM_VOICE    optional default voice id
 *
 * The provider is considered unavailable if VOXCPM_API_URL is unset, so the
 * factory can fall back to the mock provider without failing the request.
 *
 * This adapter is intentionally permissive about response shapes because
 * self-hosted VoxCPM deployments vary widely. See docs/TTS_EVALUATION.md.
 */
export class VoxCpmProvider implements TtsProvider {
    readonly name = "voxcpm" as const;
    private readonly apiUrl: string | undefined;
    private readonly apiKey: string | undefined;

    constructor() {
        this.apiUrl = process.env.VOXCPM_API_URL;
        this.apiKey = process.env.VOXCPM_API_KEY;
    }

    isAvailable(): boolean {
        return !!this.apiUrl;
    }

    async synthesize(input: TtsGenerateInput): Promise<TtsGenerateResult> {
        if (!this.apiUrl) throw new Error("VoxCPM not configured: VOXCPM_API_URL is missing");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);

        try {
            const res = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
                },
                body: JSON.stringify({
                    text: input.text,
                    voice: input.voice ?? process.env.VOXCPM_VOICE ?? undefined,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                throw new Error(`VoxCPM synthesis failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`);
            }

            const ct = res.headers.get("content-type") ?? "";
            // If server returns audio/* directly, use bytes as-is.
            if (ct.startsWith("audio/")) {
                const buf = Buffer.from(await res.arrayBuffer());
                // Duration unknown — derive from header or estimate.
                const ext = ct.includes("mpeg") ? "mp3" : "wav";
                return {
                    audioBuffer: buf,
                    durationMs: 0, // filled by caller or storage probe if needed
                    provider: this.name,
                    mimeType: ct.split(";")[0],
                    ext,
                };
            }

            // Otherwise expect JSON: { audio: base64, mimeType?, durationMs? } or { data: base64 }
            const json = (await res.json()) as Record<string, unknown>;
            const b64 = (json.audio ?? json.data ?? json.base64) as string | undefined;
            if (typeof b64 === "string" && b64.length > 0) {
                const buf = Buffer.from(b64, "base64");
                return {
                    audioBuffer: buf,
                    durationMs: (json.durationMs as number) ?? 0,
                    provider: this.name,
                    mimeType: (json.mimeType as string) ?? "audio/wav",
                    ext: (json.ext as string) ?? "wav",
                };
            }

            throw new Error("VoxCPM response was not audio and contained no base64 audio field");
        } finally {
            clearTimeout(timeout);
        }
    }
}
