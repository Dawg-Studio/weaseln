import { getCloudinaryImage, uploadCloudinary } from "@/lib/cloudinary";

export type ImageActor = { userId: string };

export type ImagePurpose =
    | "cover"
    | "post_background"
    | "profile"
    | "organization";

/**
 * The status travels with the error so the route that serves the file keeps
 * its own 400, 413 and 415 responses without matching on message text.
 */
export class ImageUploadError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ImageUploadError";
        this.status = status;
    }
}

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MiB

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

const FORMAT_MIME_TYPES = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
} as const;

/**
 * The folders the app already uses: a post cover is a post asset, a post
 * background is a background asset, and so on.
 */
const FOLDERS: Record<ImagePurpose, string> = {
    cover: "post",
    post_background: "background",
    profile: "user",
    organization: "organization",
};

/**
 * The Content-Type on a multipart part is whatever the client claims, so a
 * renamed .exe arrives labelled `image/png`. Read the leading bytes and require
 * them to spell one of the formats we accept.
 */
function sniffImageFormat(
    header: Uint8Array,
): "png" | "jpeg" | "webp" | null {
    const matches = (offset: number, ...bytes: number[]) =>
        bytes.every((byte, index) => header[offset + index] === byte);

    // 89 "PNG" CR LF SUB LF
    if (matches(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
        return "png";
    // SOI followed by the first marker.
    if (matches(0, 0xff, 0xd8, 0xff)) return "jpeg";
    // "RIFF", four bytes of chunk length, then "WEBP".
    if (
        matches(0, 0x52, 0x49, 0x46, 0x46) &&
        matches(8, 0x57, 0x45, 0x42, 0x50)
    )
        return "webp";
    return null;
}

export async function uploadImage(
    actor: ImageActor,
    input: {
        /** base64, no data-url prefix */
        data: string;
        filename?: string;
        purpose: ImagePurpose;
        /** what the caller claims the file is, when it has one */
        mimeType?: string;
    },
): Promise<{ url: string }> {
    const bytes = Buffer.from(input.data, "base64");

    if (bytes.length === 0) {
        throw new ImageUploadError("No image file found", 400);
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
        throw new ImageUploadError("Image must be 3 MiB or smaller", 413);
    }
    if (input.mimeType && !ALLOWED_MIME_TYPES.includes(input.mimeType)) {
        throw new ImageUploadError("Image must be a PNG, JPEG or WebP", 415);
    }

    // Twelve bytes is every signature we test: PNG needs 8, JPEG 3, and WebP
    // reads "WEBP" at offset 8.
    const format = sniffImageFormat(bytes.subarray(0, 12));
    if (!format) {
        throw new ImageUploadError(
            "File contents are not a PNG, JPEG or WebP image",
            415,
        );
    }

    // The part Cloudinary receives has to carry the type the bytes really
    // are: a rebuilt File with no type reaches it as octet-stream.
    const mimeType = FORMAT_MIME_TYPES[format];
    const cloudinary = await uploadCloudinary({
        file: new File([bytes], input.filename ?? `image.${format}`, {
            type: mimeType,
        }),
        folder: FOLDERS[input.purpose],
        public_id: `${actor.userId}-${Date.now()}`,
    });
    if (!cloudinary.upload.ok) {
        throw new ImageUploadError("Upload failed", 500);
    }
    const url = getCloudinaryImage({
        timestamp: cloudinary.metadata.timestamp,
        public_id: cloudinary.metadata.public_id,
        folder: cloudinary.metadata.folder,
    });
    return { url };
}
