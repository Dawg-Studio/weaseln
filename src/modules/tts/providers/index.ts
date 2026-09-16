import type { TtsProvider, TtsProviderName } from "../types";
import { MockWavProvider } from "./mockWav";
import { VoxCpmProvider } from "./voxcpm";

export type ProviderFactoryOpts = {
    preferred?: TtsProviderName | string;
};

let cached: TtsProvider | null = null;

/**
 * Resolve the active TTS provider.
 *
 * Order:
 *  1. Explicit preferred (request override)
 *  2. TTS_PROVIDER env (mock | voxcpm | auto)
 *  3. Auto: use voxcpm if configured, otherwise mock
 *
 * The factory never throws for "unavailable" — it always returns a provider
 * that can synthesize (mock). Callers that need strict VoxCPM should check
 * provider.name === "voxcpm" and surface UNAVAILABLE if isAvailable() is false.
 */
export function getTtsProvider(opts?: ProviderFactoryOpts): TtsProvider {
    const envPref = (process.env.TTS_PROVIDER ?? "auto").toLowerCase();
    const preferred = (opts?.preferred ?? envPref).toLowerCase();

    if (preferred === "voxcpm") {
        const p = new VoxCpmProvider();
        if (p.isAvailable()) return p;
        // If VoxCPM requested but not available, fall back to mock but caller
        // can detect via isAvailable if they need to surface error.
        return p;
    }
    if (preferred === "mock") return new MockWavProvider();
    if (preferred === "browser") {
        // Browser provider is client-only (speechSynthesis); server always uses mock/voxcpm.
        return new MockWavProvider();
    }
    // auto
    const voxcpm = new VoxCpmProvider();
    if (voxcpm.isAvailable()) return voxcpm;
    if (cached) return cached;
    cached = new MockWavProvider();
    return cached;
}

export function isVoxCpmConfigured(): boolean {
    return !!process.env.VOXCPM_API_URL;
}

export { MockWavProvider } from "./mockWav";
export { VoxCpmProvider } from "./voxcpm";
