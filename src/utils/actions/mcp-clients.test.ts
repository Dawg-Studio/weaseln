import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMcpClient, revokeMcpClient } from "@/utils/actions/oauth";

const { authMock, findUniqueMock, createMock, redirectMock, updateMock } =
    vi.hoisted(() => ({
        authMock: vi.fn(),
        findUniqueMock: vi.fn(),
        createMock: vi.fn(),
        redirectMock: vi.fn(),
        updateMock: vi.fn(),
    }));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        oAuthClient: {
            findUnique: findUniqueMock,
            create: createMock,
            update: updateMock,
        },
        oAuthAuthorizationCode: { create: vi.fn() },
        oAuthRefreshToken: { updateMany: vi.fn() },
    },
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

describe("mcp client actions", () => {
    beforeEach(() => {
        authMock.mockReset();
        findUniqueMock.mockReset();
        createMock.mockReset();
        updateMock.mockReset();
        redirectMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "alice" } });
        redirectMock.mockImplementation((url: string) => {
            throw new Error(`REDIRECT ${url}`);
        });
    });

    it("registers a client for the signed-in user", async () => {
        const created = await createMcpClient({
            name: "OpenCode",
            redirectUris: ["http://127.0.0.1:19876/callback"],
            scopes: ["posts:read"],
        });

        expect(created.clientSecret).toMatch(/^sk-/);
        expect(created.clientId).toBeTruthy();
    });

    it("refuses a redirect URI that is not a loopback or https URI", async () => {
        await expect(
            createMcpClient({
                name: "OpenCode",
                redirectUris: ["http://example.com/callback"],
                scopes: ["posts:read"],
            }),
        ).rejects.toThrow("Invalid redirect URI");
    });

    it("refuses a scope the app does not know", async () => {
        await expect(
            createMcpClient({
                name: "OpenCode",
                redirectUris: ["http://127.0.0.1:19876/callback"],
                scopes: ["posts:destroy"],
            }),
        ).rejects.toThrow("Invalid scope");
    });

    it("revokes a client owned by the signed-in user", async () => {
        updateMock.mockResolvedValue({ id: "client-row-1" });

        await revokeMcpClient({ clientId: "client-1" });

        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateMock.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    });

    it("refuses to revoke a client owned by another user", async () => {
        updateMock.mockRejectedValue(
            Object.assign(new Error("Record not found"), { code: "P2025" }),
        );

        await expect(
            revokeMcpClient({ clientId: "client-1" }),
        ).rejects.toThrow("Not authorized");
    });
});
