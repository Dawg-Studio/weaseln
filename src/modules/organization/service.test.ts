import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const { createMock, updateMock, findUniqueMock, findManyMock } = vi.hoisted(
    () => ({
        createMock: vi.fn(),
        updateMock: vi.fn(),
        findUniqueMock: vi.fn(),
        findManyMock: vi.fn(),
    }),
);

vi.mock("@/db", () => ({
    default: {
        organization: {
            create: createMock,
            update: updateMock,
            findUnique: findUniqueMock,
            findMany: findManyMock,
        },
    },
}));

import {
    addOrganizationMember,
    createOrganization,
    demoteOrganizationMember,
    listOrganizations,
    promoteOrganizationMember,
    updateOrganization,
} from "./service";

const notFound = Object.assign(new Error("Record not found"), {
    code: "P2025",
});

describe("organization service", () => {
    beforeEach(() => {
        createMock.mockReset();
        updateMock.mockReset();
        findUniqueMock.mockReset();
        findManyMock.mockReset();
        updateMock.mockResolvedValue({ id: "org-1" });
    });

    it("rejects an update from a user who does not own the organization", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "alice" });

        await expect(
            updateOrganization({ userId: "bob" }, { organizationId: "org-1", name: "x" }),
        ).rejects.toThrow("Not authorized");
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("owner-scopes the update mutation", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "alice" });

        await updateOrganization(
            { userId: "alice" },
            { organizationId: "org-1", name: "x" },
        );

        expect(updateMock.mock.calls[0][0].where).toEqual({
            id: "org-1",
            ownerId: "alice",
        });
    });

    it("lets an admin add a member", async () => {
        await addOrganizationMember(
            { userId: "alice" },
            { organizationId: "org-1", memberId: "bob" },
        );

        expect(updateMock.mock.calls[0][0].where).toEqual({
            id: "org-1",
            OR: [
                { ownerId: "alice" },
                { admins: { some: { id: "alice" } } },
            ],
        });
    });

    it("refuses to let an admin promote a member", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "owner1" });

        await expect(
            promoteOrganizationMember(
                { userId: "alice" },
                { organizationId: "org-1", memberId: "bob" },
            ),
        ).rejects.toThrow("Not authorized");
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("refuses to demote the owner", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "alice" });

        await expect(
            demoteOrganizationMember(
                { userId: "alice" },
                { organizationId: "org-1", memberId: "alice" },
            ),
        ).rejects.toThrow("Not authorized");
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("lists an organization once with the caller's role", async () => {
        findManyMock.mockResolvedValue([
            {
                id: "org-1",
                name: "Dawg Studio",
                username: "dawg",
                ownerId: "alice",
                admins: [{ id: "alice" }],
                members: [{ id: "alice" }],
            },
            {
                id: "org-2",
                name: "Another",
                username: "another",
                ownerId: "someone",
                admins: [],
                members: [{ id: "alice" }],
            },
        ]);

        const orgs = await listOrganizations({ userId: "alice" });

        expect(orgs).toEqual([
            { id: "org-1", name: "Dawg Studio", username: "dawg", role: "owner" },
            {
                id: "org-2",
                name: "Another",
                username: "another",
                role: "member",
            },
        ]);
    });

    it("refuses a username that is already taken", async () => {
        findUniqueMock.mockResolvedValue({ id: "org-1" });

        await expect(
            createOrganization(
                { userId: "alice" },
                { name: "Dawg Studio", username: "dawg" },
            ),
        ).rejects.toThrow("Username already taken");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("maps a missing organization to a not authorized error", async () => {
        findUniqueMock.mockResolvedValue(null);
        updateMock.mockRejectedValue(notFound);

        await expect(
            updateOrganization(
                { userId: "alice" },
                { organizationId: "missing", name: "x" },
            ),
        ).rejects.toThrow("Not authorized");
    });
});
