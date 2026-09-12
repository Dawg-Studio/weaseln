import { describe, it, expect, vi } from "vitest";

const { findManyMock, countMock, authMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
    countMock: vi.fn(),
    authMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: { userNotifications: { findMany: findManyMock, count: countMock } },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));

import { GET as getNotifications } from "@/app/api/notification/route";
import { GET as getCount } from "@/app/api/notification/count/route";

describe("anonymous access to /api/notification", () => {
    it("returns 401 when no session", async () => {
        authMock.mockResolvedValueOnce(null);
        const req = new Request("http://localhost/api/notification");
        const res = await getNotifications(req);
        expect(res.status).toBe(401);
    });
});

describe("anonymous access to /api/notification/count", () => {
    it("returns 401 when no session", async () => {
        authMock.mockResolvedValueOnce(null);
        const res = await getCount();
        expect(res.status).toBe(401);
    });
});

describe("authenticated /api/notification", () => {
    it("uses take: 50 + cursor pagination", async () => {
        authMock.mockResolvedValueOnce({ user: { id: "u1" } } as any);
        findManyMock.mockResolvedValueOnce([]);
        const req = new Request("http://localhost/api/notification?cursor=c1");
        await getNotifications(req);
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ userId: "u1" }),
                take: 50,
                cursor: { id: "c1" },
                skip: 1,
            }),
        );
    });

    it("returns data[] rows with post.title and excludes self-notifications", async () => {
        authMock.mockResolvedValueOnce({ user: { id: "u1" } } as any);
        findManyMock.mockResolvedValueOnce([
            { id: "n1", post: { title: "Hello" } },
        ] as any);
        const req = new Request("http://localhost/api/notification");
        const res = await getNotifications(req);
        const body = await res.json();
        expect(body).toEqual({
            data: [{ id: "n1", post: { title: "Hello" } }],
            lastCursor: "n1",
        });
        expect(findManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "u1",
                    OR: [
                        { fromUserId: { not: "u1" } },
                        { fromUserId: null },
                    ],
                }),
            }),
        );
    });
});
