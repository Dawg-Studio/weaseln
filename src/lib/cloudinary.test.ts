import { describe, expect, it, vi, beforeEach } from "vitest";
import { cloudinarySignature } from "@/utils/cloudinarySignature";
import { getPrivateDownloadUrl } from "./cloudinary";

describe("cloudinary helpers", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_CLOUDINARY_NAME", "leindfraust");
        vi.stubEnv("NEXT_CLOUDINARY_API", "123456789");
        vi.stubEnv("NEXT_CLOUDINARY_SECRET", "secret");
    });

    it("signs upload params alphabetically so image uploads keep their signature", () => {
        const sig = cloudinarySignature(
            { folder: "postdevfy/user", format: "jpg", public_id: "alice", timestamp: "1700000000" },
            "secret",
        );
        // sha1("folder=postdevfy/user&format=jpg&public_id=alice&timestamp=1700000000secret")
        expect(sig).toBe("7b7d7a6fa3689686bda4f1eb0c6b70e1e94a7f23");
    });

    it("builds a 60-second private download URL for a raw PDF", () => {
        const url = new URL(
            getPrivateDownloadUrl({ public_id: "alice-1700000000", folder: "postdevfy/portfolio", format: "pdf", expiresAt: 1700000060 }),
        );
        expect(url.origin + url.pathname).toBe("https://api.cloudinary.com/v1_1/leindfraust/raw/download");
        expect(url.searchParams.get("expires_at")).toBe("1700000060");
        expect(url.searchParams.get("type")).toBe("private");
        expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{40}$/);
    });
});
