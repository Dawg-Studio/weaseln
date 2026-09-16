import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type StoreAudioOpts = {
    postId: string;
    buffer: Buffer;
    ext: string;
};

/**
 * Persist synthesized audio.
 *
 * Default: write to public/audio/<postId>.<ext> so Next.js serves it as a
 * same-origin static asset at /audio/<postId>.<ext>. Overwrites any previous
 * generation for the same post (storage is bounded to 1 file per post).
 *
 * If TTS_STORAGE_DIR is set, writes there instead (useful for volume mounts).
 * If TTS_USE_CLOUDINARY=1, caller should upload externally — this helper
 * always does the local write as a fallback/cache.
 */
export async function storeAudio(opts: StoreAudioOpts): Promise<string> {
    const dir = process.env.TTS_STORAGE_DIR
        ? process.env.TTS_STORAGE_DIR
        : join(process.cwd(), "public", "audio");
    await mkdir(dir, { recursive: true });
    const filename = `${opts.postId}.${opts.ext}`;
    const fullPath = join(dir, filename);
    await writeFile(fullPath, opts.buffer);
    // Public URL — respects custom dir via symlink assumption; if TTS_PUBLIC_PREFIX set, use it.
    const prefix = process.env.TTS_PUBLIC_PREFIX ?? "/audio";
    return `${prefix}/${filename}`;
}

export function audioPublicUrl(postId: string, ext = "wav"): string {
    const prefix = process.env.TTS_PUBLIC_PREFIX ?? "/audio";
    return `${prefix}/${postId}.${ext}`;
}
