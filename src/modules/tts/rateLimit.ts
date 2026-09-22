import { TTS_LIMITS } from "./limits";

type Stamp = number; // epoch ms

// In-memory sliding windows. Suitable for single-instance dev; replace with
// Redis/DB for multi-instance production (see docs/TTS_EVALUATION.md "Scaling").
const userWindow = new Map<string, Stamp[]>();
const postWindow = new Map<string, Stamp[]>();

function prune(arr: Stamp[], windowMs: number): Stamp[] {
    const cutoff = Date.now() - windowMs;
    return arr.filter((t) => t > cutoff);
}

export function checkRateLimit(args: { userId: string; postId: string }): { allowed: boolean; retryAfterMs?: number } {
    const windowMs = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    // Per-user
    const uStamps = prune(userWindow.get(args.userId) ?? [], windowMs);
    if (uStamps.length >= TTS_LIMITS.rateLimitPerHour) {
        const oldest = uStamps[0] ?? now;
        return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
    }

    // Per-post
    const pStamps = prune(postWindow.get(args.postId) ?? [], windowMs);
    if (pStamps.length >= TTS_LIMITS.maxRequestsPerPostPerHour) {
        const oldest = pStamps[0] ?? now;
        return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
    }

    return { allowed: true };
}

export function recordRateLimit(args: { userId: string; postId: string }) {
    const now = Date.now();
    const u = userWindow.get(args.userId) ?? [];
    u.push(now);
    userWindow.set(args.userId, u);
    const p = postWindow.get(args.postId) ?? [];
    p.push(now);
    postWindow.set(args.postId, p);
}

// Exposed for tests
export function _resetRateLimit() {
    userWindow.clear();
    postWindow.clear();
}
