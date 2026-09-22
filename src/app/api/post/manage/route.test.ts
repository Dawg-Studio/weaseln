import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { DELETE, PUT } from "./route";

const mockAuth = vi.fn();
const mockPostFindUnique = vi.fn();
const mockPostUpdate = vi.fn();
const mockPostDelete = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({
    default: {
        post: {
            findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
            update: (...args: unknown[]) => mockPostUpdate(...args),
            delete: (...args: unknown[]) => mockPostDelete(...args),
        },
    },
}));

function manageRequest(method: "PUT" | "DELETE", query = "postId=post-1") {
    return new Request(`http://localhost/api/post/manage?${query}`, {
        method,
    }) as unknown as NextRequest;
}

describe("/api/post/manage ownership", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockPostFindUnique.mockReset();
        mockPostUpdate.mockReset();
        mockPostDelete.mockReset();
        mockPostUpdate.mockResolvedValue({ id: "post-1" });
        mockPostDelete.mockResolvedValue({ id: "post-1" });
    });

    it.each([
        ["PUT", PUT],
        ["DELETE", DELETE],
    ] as const)("rejects an anonymous %s before reading a post", async (method, handler) => {
        mockAuth.mockResolvedValue(null);

        const res = await handler(manageRequest(method));

        expect(res.status).toBe(401);
        expect(mockPostFindUnique).not.toHaveBeenCalled();
        expect(mockPostUpdate).not.toHaveBeenCalled();
        expect(mockPostDelete).not.toHaveBeenCalled();
    });

    it("rejects a PUT for another user's post with 403", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "bob" });

        const res = await PUT(
            manageRequest("PUT", "postId=bobs-post&publish=true"),
        );

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Forbidden" });
        expect(mockPostFindUnique).toHaveBeenCalledWith({
            where: { id: "bobs-post" },
            select: { userId: true },
        });
        expect(mockPostUpdate).not.toHaveBeenCalled();
    });

    it("rejects a DELETE for another user's post with 403", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "bob" });

        const res = await DELETE(
            manageRequest("DELETE", "postId=bobs-post"),
        );

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Forbidden" });
        expect(mockPostDelete).not.toHaveBeenCalled();
    });

    it("owner-scopes the final publish mutation", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "alice" });

        const res = await PUT(
            manageRequest("PUT", "postId=alices-post&publish=true"),
        );

        expect(res.status).toBe(200);
        expect(mockPostUpdate).toHaveBeenCalledWith({
            where: { id: "alices-post", userId: "alice" },
            data: { published: true },
        });
    });

    it("owner-scopes the final delete mutation", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "alice" });

        const res = await DELETE(
            manageRequest("DELETE", "postId=alices-post"),
        );

        expect(res.status).toBe(200);
        expect(mockPostDelete).toHaveBeenCalledWith({
            where: { id: "alices-post", userId: "alice" },
        });
    });

    it.each([
        ["PUT", PUT],
        ["DELETE", DELETE],
    ] as const)("returns 404 when %s targets a missing post", async (method, handler) => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue(null);

        const query =
            method === "PUT"
                ? "postId=missing&publish=true"
                : "postId=missing";
        const res = await handler(manageRequest(method, query));

        expect(res.status).toBe(404);
        expect(mockPostUpdate).not.toHaveBeenCalled();
        expect(mockPostDelete).not.toHaveBeenCalled();
    });
});
