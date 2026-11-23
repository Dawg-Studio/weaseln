import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    addOrganizationMember,
    demoteOrganizationMember,
    listOrganizations,
    promoteOrganizationMember,
    updateOrganization,
} from "@/modules/organization/service";

import {
    handleListOrgs,
    handleUpdateOrg,
    handleUpdateOrgMember,
} from "./organization";

const { findUserMock } = vi.hoisted(() => ({ findUserMock: vi.fn() }));

vi.mock("@/db", () => ({
    default: { user: { findUnique: findUserMock } },
}));
vi.mock("@/modules/organization/service", () => ({
    listOrganizations: vi.fn(),
    getOrganization: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    addOrganizationMember: vi.fn(),
    removeOrganizationMember: vi.fn(),
    promoteOrganizationMember: vi.fn(),
    demoteOrganizationMember: vi.fn(),
}));

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["org:read", "org:write"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("organization tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(listOrganizations).mockResolvedValue([]);
        findUserMock.mockResolvedValue({ id: "user-2", username: "bob" });
    });

    it("lists the caller's organizations", async () => {
        await handleListOrgs({}, context);

        expect(listOrganizations).toHaveBeenCalledWith({ userId: "alice" });
    });

    it("resolves a member by username", async () => {
        await handleUpdateOrgMember(
            { orgId: "org-1", username: "bob", action: "add" },
            context,
        );

        expect(findUserMock).toHaveBeenCalledWith({
            where: { username: "bob" },
            select: { id: true, username: true },
        });
        expect(addOrganizationMember).toHaveBeenCalledWith(
            { userId: "alice" },
            { organizationId: "org-1", memberId: "user-2" },
        );
    });

    it("promotes a member through the owner-only path", async () => {
        await handleUpdateOrgMember(
            { orgId: "org-1", username: "bob", action: "promote" },
            context,
        );

        expect(promoteOrganizationMember).toHaveBeenCalledTimes(1);
    });

    it("demotes a member through the owner-only path", async () => {
        await handleUpdateOrgMember(
            { orgId: "org-1", username: "bob", action: "demote" },
            context,
        );

        expect(demoteOrganizationMember).toHaveBeenCalledTimes(1);
    });

    it("names a username that does not exist", async () => {
        findUserMock.mockResolvedValue(null);

        const result = await handleUpdateOrgMember(
            { orgId: "org-1", username: "nobody", action: "add" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("nobody");
        expect(addOrganizationMember).not.toHaveBeenCalled();
    });

    it("updates only an organization the caller owns", async () => {
        vi.mocked(updateOrganization).mockRejectedValue(
            new Error("Not authorized"),
        );

        const result = await handleUpdateOrg(
            { orgId: "org-1", name: "x" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Not authorized");
    });
});
