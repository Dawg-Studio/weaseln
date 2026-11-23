import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockAuth = vi.fn();
const mockUrl = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/modules/portfolio/resume", () => ({
    getResumeDownloadUrl: (...args: unknown[]) => mockUrl(...args),
}));

const request = () =>
    new Request("http://localhost/api/portfolio/resume/download?userId=alice");

describe("GET /api/portfolio/resume/download", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockUrl.mockReset();
        mockAuth.mockResolvedValue(null);
    });

    it("answers 404 for a private resume seen by a stranger", async () => {
        mockUrl.mockResolvedValue(null);
        const response = await GET(request());
        expect(response.status).toBe(404);
        expect(mockUrl).toHaveBeenCalledWith(null, { userId: "alice" });
    });

    it("redirects a stranger when the owner published it", async () => {
        mockUrl.mockResolvedValue("https://api.cloudinary.com/v1_1/x/raw/download?signed");
        const response = await GET(request());
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain("signed");
    });

    it("passes the owner's id through so a private resume still downloads", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockUrl.mockResolvedValue("https://api.cloudinary.com/v1_1/x/raw/download?signed");
        const response = await GET(request());
        expect(mockUrl).toHaveBeenCalledWith({ userId: "alice" }, { userId: "alice" });
        expect(response.status).toBe(302);
    });

    it("requires a userId", async () => {
        const response = await GET(new Request("http://localhost/api/portfolio/resume/download"));
        expect(response.status).toBe(400);
    });
});
