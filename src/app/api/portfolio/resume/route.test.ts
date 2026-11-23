import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";
import { ResumeError } from "@/modules/portfolio/resume";
import { MAX_RESUME_BYTES, MULTIPART_ENVELOPE_BYTES } from "@/modules/portfolio/types";

const mockAuth = vi.fn();
const mockUpload = vi.fn();
const mockRemove = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/modules/portfolio/resume", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/modules/portfolio/resume")>();
    return {
        ...actual,
        uploadResume: (...args: unknown[]) => mockUpload(...args),
        removeResume: (...args: unknown[]) => mockRemove(...args),
    };
});

// The route only reads formData(); building a real multipart body would mean
// crossing jsdom's FormData with undici's Request, which rejects each other's
// File instances.
const multipart = (file: File, headers?: Record<string, string>) => {
    const body = new FormData();
    body.append("resume", file);
    return {
        formData: async () => body,
        headers: new Headers(headers ?? {}),
    } as unknown as Request;
};

describe("POST /api/portfolio/resume", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockUpload.mockReset();
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockUpload.mockResolvedValue({
            url: "https://res.cloudinary.com/x",
            proposal: { headline: null, summary: null, location: null, links: [], skills: [], experience: [] },
            error: null,
        });
    });

    it("returns 401 without a session", async () => {
        mockAuth.mockResolvedValue(null);
        expect((await POST(multipart(new File(["%PDF-1.4"], "r.pdf")))).status).toBe(401);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("returns 415 for a file whose bytes are not a PDF", async () => {
        const res = await POST(
            multipart(new File(["hello"], "resume.pdf", { type: "application/pdf" })),
        );
        expect(res.status).toBe(415);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("answers 422 when the file is stored but unparseable", async () => {
        mockUpload.mockResolvedValue({
            url: "https://res.cloudinary.com/x",
            proposal: null,
            error: "Could not read this resume",
        });
        const res = await POST(multipart(new File(["%PDF-1.4"], "r.pdf")));
        expect(res.status).toBe(422);
        expect(await res.json()).toMatchObject({
            url: "https://res.cloudinary.com/x",
            proposal: null,
        });
    });

    it("stores a valid PDF and returns the proposal", async () => {
        const res = await POST(multipart(new File(["%PDF-1.4"], "r.pdf")));
        expect(res.status).toBe(201);
        expect(mockUpload).toHaveBeenCalledTimes(1);
    });

    it("refuses an oversized request before reading the body", async () => {
        const res = await POST(
            multipart(new File(["%PDF-1.4"], "r.pdf"), {
                "content-length": String(MAX_RESUME_BYTES + MULTIPART_ENVELOPE_BYTES + 1),
            }),
        );
        expect(res.status).toBe(413);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("refuses an oversized file before reading it", async () => {
        const file = new File(["%PDF-1.4"], "big.pdf");
        Object.defineProperty(file, "size", { value: MAX_RESUME_BYTES + 1 });
        const res = await POST(multipart(file));
        expect(res.status).toBe(413);
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("answers a refused removal with the status the service used", async () => {
        mockRemove.mockRejectedValueOnce(
            new ResumeError("Could not delete the stored file", 502),
        );
        const res = await DELETE();
        expect(res.status).toBe(502);
        expect(await res.json()).toMatchObject({
            error: "Could not delete the stored file",
        });
    });
});
