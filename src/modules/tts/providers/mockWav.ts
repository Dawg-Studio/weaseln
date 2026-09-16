import type { TtsProvider, TtsGenerateInput, TtsGenerateResult } from "../types";
import { TTS_LIMITS } from "../limits";

/**
 * MockWav provider — zero-dependency server-side audio that proves the
 * end-to-end plumbing without requiring VoxCPM weights, GPU, or API keys.
 *
 * It synthesizes a valid WAV (PCM 16-bit, 24kHz, mono) whose duration is
 * proportional to word count, filled with a gentle sine tone so the file is
 * audibly "something" rather than pure silence. Clients can verify playback
 * via <audio controls>.
 *
 * Replace or supersede with VoxCPM by setting TTS_PROVIDER=voxcpm and
 * VOXCPM_API_URL — see src/modules/tts/providers/voxcpm.ts
 */
export class MockWavProvider implements TtsProvider {
    readonly name = "mock" as const;

    isAvailable(): boolean {
        return true;
    }

    async synthesize(input: TtsGenerateInput): Promise<TtsGenerateResult> {
        const text = input.text.trim();
        if (!text) throw new Error("Empty text");

        // Estimate duration: ~150 wpm → 0.4s per word, clamped to limits.
        const words = text.split(/\s+/).filter(Boolean).length;
        const estimatedSec = Math.max(2, Math.min(words * 0.45, TTS_LIMITS.maxDurationMs / 1000));
        // Also bound by char count for very long repetitive text
        const charSec = text.length * 0.015; // 15ms per char
        const durationSec = Math.max(2, Math.min(Math.max(estimatedSec, charSec), TTS_LIMITS.maxDurationMs / 1000));
        const durationMs = Math.round(durationSec * 1000);

        const sampleRate = 24000;
        const numSamples = Math.floor(sampleRate * durationSec);
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const dataSize = numSamples * blockAlign;
        const buffer = Buffer.alloc(44 + dataSize);

        // RIFF header
        buffer.write("RIFF", 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write("WAVE", 8);
        buffer.write("fmt ", 12);
        buffer.writeUInt32LE(16, 16); // PCM chunk size
        buffer.writeUInt16LE(1, 20); // PCM format
        buffer.writeUInt16LE(numChannels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(bitsPerSample, 34);
        buffer.write("data", 36);
        buffer.writeUInt32LE(dataSize, 40);

        // PCM data: gentle 220Hz sine with slow tremolo so it's audible but not harsh.
        // Envelope: fade in/out 80ms to avoid clicks.
        const freq = 220;
        const fadeSamples = Math.min(Math.floor(sampleRate * 0.08), Math.floor(numSamples / 6));
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope =
                i < fadeSamples
                    ? i / fadeSamples
                    : i > numSamples - fadeSamples
                      ? (numSamples - i) / fadeSamples
                      : 1;
            // Add subtle word-paced amplitude variation so longer text sounds less monotone
            const wordPhase = (i / sampleRate) * 2; // 2 Hz wobble
            const wobble = 0.85 + 0.15 * Math.sin(2 * Math.PI * wordPhase);
            const sample = Math.sin(2 * Math.PI * freq * t) * 7000 * envelope * wobble;
            buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample))), 44 + i * 2);
        }

        return {
            audioBuffer: buffer,
            durationMs,
            provider: this.name,
            mimeType: "audio/wav",
            ext: "wav",
        };
    }
}
