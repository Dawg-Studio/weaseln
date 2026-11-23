import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({
    default: {
        user: {
            update: (...a: unknown[]) => mockUpdate(...a),
            findUnique: (...a: unknown[]) => mockFindUnique(...a),
        },
        post: { updateMany: (...a: unknown[]) => mockUpdateMany(...a) },
        // The interactive transaction form: the callback runs against a tx
        // that offers the same models. The call is recorded so a test can see
        // the isolation level it ran at.
        $transaction: async (
            fn: (_tx: unknown) => Promise<unknown>,
            options?: unknown,
        ) => {
            mockTransaction(fn, options);
            return fn({
                user: {
                    update: (...a: unknown[]) => mockUpdate(...a),
                    findUnique: (...a: unknown[]) => mockFindUnique(...a),
                },
            });
        },
    },
}));

const patch = (body: unknown) =>
    PATCH(new Request("http://localhost/api/user", { method: "PATCH", body: JSON.stringify(body) }));

describe("PATCH /api/user", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockUpdate.mockReset();
        mockUpdateMany.mockReset();
        mockTransaction.mockReset();
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockUpdate.mockResolvedValue({ id: "alice" });
        mockUpdateMany.mockResolvedValue({ count: 0 });
        mockFindUnique.mockResolvedValue({ socials: [] });
        // The route logs a failure it does not hand to the client. The spy is
        // restored in afterEach, so a failing assertion cannot leave it
        // silencing the tests that follow.
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    it("merges the socials inside a serializable transaction", async () => {
        await patch({ name: "Alice", socials: [{ name: "Facebook", url: "https://fb" }] });
        expect(mockTransaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ isolationLevel: "Serializable" }),
        );
    });

    it("refuses an empty username", async () => {
        const res = await patch({ name: "Alice", username: "   " });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuses a social without a url", async () => {
        const res = await patch({ name: "Alice", socials: [{ name: "Facebook" }] });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuses socials that are not a list", async () => {
        const res = await patch({
            name: "Alice",
            socials: { name: "Facebook", url: "https://fb" },
        });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("refuses a social whose url is not a string", async () => {
        const res = await patch({
            name: "Alice",
            socials: [{ name: "Facebook", url: 42 }],
        });
        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
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

    it("answers a taken username with the field the form points at", async () => {
        mockUpdate.mockRejectedValue({ code: "P2002" });

        const res = await patch({ username: "alice" });

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
            error: {
                message: "Username already taken",
                meta: { target: ["username"] },
            },
        });
    });

    it("does not leak the failure to the client", async () => {
        mockUpdate.mockRejectedValue(new Error("prisma exploded"));

        const res = await patch({ name: "Alice" });

        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain("prisma");
    });
});
