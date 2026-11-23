import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({
    default: {
        user: {
            update: (...a: unknown[]) => mockUpdate(...a),
            findUnique: (...a: unknown[]) => mockFindUnique(...a),
        },
        post: { updateMany: (...a: unknown[]) => mockUpdateMany(...a) },
    },
}));

const patch = (body: unknown) =>
    PATCH(new Request("http://localhost/api/user", { method: "PATCH", body: JSON.stringify(body) }));

describe("PATCH /api/user", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockUpdate.mockReset();
        mockUpdateMany.mockReset();
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockUpdate.mockResolvedValue({ id: "alice" });
        mockUpdateMany.mockResolvedValue({ count: 0 });
        mockFindUnique.mockResolvedValue({ socials: [] });
    });

    it("refuses to write a resume field through the profile endpoint", async () => {
        const res = await patch({ name: "Alice", bio: "hi", resumeUrl: "javascript:alert(1)" });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("writes the allowlisted fields it is given", async () => {
        await patch({ name: "Alice", bio: "hi" });
        const call = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;
        expect(call?.data).toEqual({ name: "Alice", bio: "hi" });
    });

    it("refuses a malformed socials entry with 400", async () => {
        const res = await patch({ name: "Alice", socials: [null] });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("keeps a social the caller did not send", async () => {
        mockFindUnique.mockResolvedValue({
            socials: [
                { name: "GitHub", url: "https://github.com/alice" },
                { name: "Facebook", url: "https://old" },
            ],
        });

        await patch({ name: "Alice", socials: [{ name: "Facebook", url: "https://new" }] });

        const data = mockUpdate.mock.calls[0][0].data as {
            socials: { name: string; url: string }[];
        };
        expect(data.socials).toEqual([
            { name: "Facebook", url: "https://new" },
            { name: "GitHub", url: "https://github.com/alice" },
        ]);
    });

    it("refuses an unknown key with 400", async () => {
        const res = await patch({ name: "Alice", isAdmin: true });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuses an anonymous caller", async () => {
        mockAuth.mockResolvedValue(null);
        expect((await patch({ name: "Alice" })).status).toBe(401);
    });
});
