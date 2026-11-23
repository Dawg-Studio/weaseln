import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const { uploadCloudinaryMock, getCloudinaryImageMock } = vi.hoisted(() => ({
    uploadCloudinaryMock: vi.fn(),
    getCloudinaryImageMock: vi.fn(),
}));

vi.mock("@/lib/cloudinary", () => ({
    uploadCloudinary: uploadCloudinaryMock,
    getCloudinaryImage: getCloudinaryImageMock,
}));

import { uploadImage } from "./service";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_HEADER = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("WEBP"),
]);

function pngOfSize(size: number) {
    return Buffer.concat([PNG_HEADER, Buffer.alloc(size - PNG_HEADER.length)]);
}

describe("image service", () => {
    beforeEach(() => {
        uploadCloudinaryMock.mockReset();
        getCloudinaryImageMock.mockReset();
        uploadCloudinaryMock.mockResolvedValue({
            upload: { ok: true },
            metadata: { timestamp: 1, public_id: "image-1", folder: "post" },
        });
        getCloudinaryImageMock.mockReturnValue(
            "https://res.cloudinary.com/demo/image/upload/image-1.jpg",
        );
    });

    it("accepts a PNG at the 3 MiB cap", async () => {
        const data = pngOfSize(3 * 1024 * 1024).toString("base64");

        const result = await uploadImage(
            { userId: "alice" },
            { data, purpose: "cover" },
        );

        expect(result.url).toBe(
            "https://res.cloudinary.com/demo/image/upload/image-1.jpg",
        );
        expect(uploadCloudinaryMock).toHaveBeenCalledTimes(1);
    });

    it("rejects one byte over the 3 MiB cap", async () => {
        const data = pngOfSize(3 * 1024 * 1024 + 1).toString("base64");

        await expect(
            uploadImage({ userId: "alice" }, { data, purpose: "cover" }),
        ).rejects.toThrow("Image must be 3 MiB or smaller");
        expect(uploadCloudinaryMock).not.toHaveBeenCalled();
    });

    it("rejects a file whose bytes are not an image", async () => {
        const data = Buffer.alloc(1024, 0x41).toString("base64");

        await expect(
            uploadImage(
                { userId: "alice" },
                { data, purpose: "cover", mimeType: "image/png" },
            ),
        ).rejects.toThrow("File contents are not a PNG, JPEG or WebP image");
        expect(uploadCloudinaryMock).not.toHaveBeenCalled();
    });

    it("accepts JPEG and WebP by magic bytes", async () => {
        const jpeg = Buffer.concat([
            JPEG_HEADER,
            Buffer.alloc(256, 0x00),
        ]).toString("base64");
        const webp = Buffer.concat([
            WEBP_HEADER,
            Buffer.alloc(256, 0x00),
        ]).toString("base64");

        await uploadImage({ userId: "alice" }, { data: jpeg, purpose: "cover" });
        await uploadImage({ userId: "alice" }, { data: webp, purpose: "cover" });

        expect(uploadCloudinaryMock).toHaveBeenCalledTimes(2);
    });

    it("rejects a declared type that is not an image", async () => {
        const data = pngOfSize(64).toString("base64");

        await expect(
            uploadImage(
                { userId: "alice" },
                { data, purpose: "cover", mimeType: "application/pdf" },
            ),
        ).rejects.toThrow("Image must be a PNG, JPEG or WebP");
    });

    it("hands Cloudinary a file that says what it is", async () => {
        const data = pngOfSize(64).toString("base64");

        await uploadImage({ userId: "alice" }, { data, purpose: "cover" });

        const file = uploadCloudinaryMock.mock.calls[0][0].file as File;
        expect(file.type).toBe("image/png");
    });

    it("uses the folder that matches the purpose", async () => {
        const data = pngOfSize(64).toString("base64");

        for (const [purpose, folder] of [
            ["cover", "post"],
            ["post_background", "background"],
            ["profile", "user"],
            ["organization", "organization"],
        ] as const) {
            await uploadImage({ userId: "alice" }, { data, purpose });
            expect(uploadCloudinaryMock.mock.calls.at(-1)?.[0].folder).toBe(
                folder,
            );
        }
    });
});
