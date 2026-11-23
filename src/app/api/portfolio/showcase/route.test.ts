import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockAuth = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/modules/portfolio/service", () => ({
    createShowcase: (...args: unknown[]) => mockCreate(...args),
    updateShowcase: vi.fn(),
    deleteShowcase: vi.fn(),
}));

const request = (body: unknown) =>
    new Request("http://localhost/api/portfolio/showcase", {
        method: "POST",
        body: JSON.stringify(body),
    });

describe("POST /api/portfolio/showcase", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockCreate.mockReset();
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockCreate.mockResolvedValue({ id: "s1", slug: "work-ab12" });
    });

    it("returns 401 without a session", async () => {
        mockAuth.mockResolvedValue(null);
        expect((await POST(request({ title: "Work", layout: "grid" }))).status).toBe(401);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 when the body is invalid", async () => {
        const res = await POST(request({ title: "Work", layout: "masonry" }));
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("validates a full body before the service sees it", async () => {
        await POST(request({ title: "Work", description: null, layout: "grid" }));
        expect(mockCreate).toHaveBeenCalledWith(
            { userId: "alice" },
            { title: "Work", description: null, layout: "grid" },
        );
    });

    it("answers 404 when the service reports a missing row", async () => {
        mockCreate.mockRejectedValueOnce(new Error("Showcase not found"));
        expect((await POST(request({ title: "Work", layout: "grid" }))).status).toBe(404);
    });
});
