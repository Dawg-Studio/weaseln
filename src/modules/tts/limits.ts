import type { TtsLimits } from "./types";

/**
 * Centralized TTS limits — see docs/TTS_EVALUATION.md § "Limits & Cost".
 *
 * All values are intentionally conservative for a self-hosted Next.js
 * install without a GPU box. Tighten further before public launch if
 * VOXCPM is exposed.
 */
export const TTS_LIMITS: TtsLimits = {
    // Grapheme count after plain-text extraction (title + description + body).
    // VoxCPM quality degrades past ~6k tokens; 5000 is a safe cap for the mock
    // tone generator as well (5k chars ≈ 750 words ≈ 5 min at 150 wpm).
    maxChars: parseInt(process.env.TTS_MAX_CHARS ?? "5000", 10),

    // Hard cap on generated audio length. The mock provider clamps duration.
    maxDurationMs: 5 * 60 * 1000, // 5 minutes

    // Abuse: per-user sliding window.
    rateLimitPerHour: parseInt(process.env.TTS_RATE_LIMIT_PER_HOUR ?? "10", 10),

    // Per-post burst protection.
    maxRequestsPerPostPerHour: parseInt(
        process.env.TTS_RATE_LIMIT_PER_POST ?? "5",
        10,
    ),
};

export const TTS_MIN_CHARS = 10; // below this we consider content empty
