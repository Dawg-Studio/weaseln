export type TtsProviderName = "mock" | "voxcpm" | "browser";

export type TtsStatus = "none" | "ready" | "generating" | "failed";

export interface TtsGenerateInput {
    text: string;
    postId: string;
    voice?: string;
}

export interface TtsGenerateResult {
    audioBuffer: Buffer;
    durationMs: number;
    provider: TtsProviderName;
    mimeType: string; // e.g. audio/wav
    ext: string; // wav | mp3
}

export interface TtsProvider {
    readonly name: TtsProviderName;
    isAvailable(): Promise<boolean> | boolean;
    synthesize(_input: TtsGenerateInput): Promise<TtsGenerateResult>;
}

export interface TtsEligibility {
    eligible: boolean;
    reason?: string;
    code?: "EMPTY_CONTENT" | "TOO_LONG" | "UNSUPPORTED_LANGUAGE";
    charCount?: number;
}

export interface TtsLimits {
    maxChars: number;
    maxDurationMs: number;
    rateLimitPerHour: number;
    maxRequestsPerPostPerHour: number;
}
