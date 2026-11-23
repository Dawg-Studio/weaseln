import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const { authMock, findUniqueMock, updateMock, uploadCloudinaryMock } =
    vi.hoisted(() => ({
        authMock: vi.fn(),
        findUniqueMock: vi.fn(),
        updateMock: vi.fn(),
        uploadCloudinaryMock: vi.fn(),
    }));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({
    default: {
        organization: {
            findUnique: findUniqueMock,
            update: updateMock,
        },
    },
}));
vi.mock("@/lib/cloudinary", () => ({
    uploadCloudinary: uploadCloudinaryMock,
    getCloudinaryImage: vi.fn(),
}));

function organizationRequest(
    fields: Record<string, string>,
    withImage = false,
) {
    const body = new FormData();
    body.append("json", JSON.stringify(fields));
    // A string stands in for the file: the route only asks whether an image
    // was supplied, and jsdom's FormData will not take a File here.
    if (withImage) body.append("imgFile", "image bytes");
    return new Request("http://localhost/api/organization", {
        method: "PATCH",
        body,
    });
}

describe("PATCH /api/organization", () => {
    beforeEach(() => {
        authMock.mockReset();
        findUniqueMock.mockReset();
        updateMock.mockReset();
        uploadCloudinaryMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "alice" } });
        findUniqueMock.mockResolvedValue({ ownerId: "alice" });
    });

    it("refuses an update from a user who does not own the organization", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "bob" });

        const res = await PATCH(
            organizationRequest({ id: "org-1", name: "Renamed" }, true),
        );

        expect(res.status).toBe(403);
    });

    it("does not upload the image before the owner check", async () => {
        findUniqueMock.mockResolvedValue({ ownerId: "bob" });

        await PATCH(
            organizationRequest({ id: "org-1", name: "Renamed" }, true),
        );

        expect(uploadCloudinaryMock).not.toHaveBeenCalled();
    });

    it("rejects an anonymous request with 401", async () => {
        authMock.mockResolvedValue(null);

        const res = await PATCH(organizationRequest({ id: "org-1" }, true));

        expect(res.status).toBe(401);
        expect(uploadCloudinaryMock).not.toHaveBeenCalled();
    });
});
