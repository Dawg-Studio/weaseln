import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { MAX_UPLOAD_BYTES } from "@/modules/images/service";
import { MULTIPART_ENVELOPE_BYTES } from "@/modules/portfolio/types";

const mockAuth = vi.fn();
const mockUpload = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/modules/images/service", () => ({
    MAX_UPLOAD_BYTES: 3 * 1024 * 1024,
    ImageUploadError: class extends Error {
        readonly status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    },
    uploadImage: (...args: unknown[]) => mockUpload(...args),
}));

const multipart = (file: File, headers?: Record<string, string>) => {
    const body = new FormData();
    body.append("image", file);
    return {
        formData: async () => body,
        headers: new Headers(headers ?? {}),
    } as unknown as Request;
};

describe("POST /api/portfolio/image", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockUpload.mockReset();
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockUpload.mockResolvedValue({ url: "https://res.cloudinary.com/x/1.jpg" });
    });

    it("refuses an anonymous caller", async () => {
        mockAuth.mockResolvedValue(null);
        const res = await POST(multipart(new File(["x"], "a.png")));
        expect(res.status).toBe(401);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("answers 400 when the body is not a multipart upload", async () => {
        const res = await POST({
            formData: async () => {
                throw new TypeError("Content-Type was not multipart/form-data");
            },
            headers: new Headers(),
        } as unknown as Request);
        expect(res.status).toBe(400);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("refuses an oversized request before reading the body", async () => {
        const res = await POST(
            multipart(new File(["x"], "a.png"), {
                "content-length": String(MAX_UPLOAD_BYTES + MULTIPART_ENVELOPE_BYTES + 1),
            }),
        );
        expect(res.status).toBe(413);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("refuses an oversized image before reading it", async () => {
        const file = new File(["x"], "big.png");
        Object.defineProperty(file, "size", { value: MAX_UPLOAD_BYTES + 1 });
        const res = await POST(multipart(file));
        expect(res.status).toBe(413);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("stores an image and returns its url", async () => {
        const res = await POST(multipart(new File(["x"], "a.png")));
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ url: "https://res.cloudinary.com/x/1.jpg" });
    });
});
