import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    createPost,
    deletePost,
    listPosts,
    setPostPublished,
    updatePost,
} from "./service";

const mockPostCreate = vi.fn();
const mockPostUpdate = vi.fn();
const mockPostFindMany = vi.fn();
const mockPostFindUnique = vi.fn();
const mockPostDelete = vi.fn();
const mockUserFindUnique = vi.fn();
const mockOrganizationFindUnique = vi.fn();

vi.mock("@/db", () => ({
    default: {
        post: {
            create: (...args: unknown[]) => mockPostCreate(...args),
            update: (...args: unknown[]) => mockPostUpdate(...args),
            findMany: (...args: unknown[]) => mockPostFindMany(...args),
            findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
            delete: (...args: unknown[]) => mockPostDelete(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
        organization: {
            findUnique: (...args: unknown[]) =>
                mockOrganizationFindUnique(...args),
        },
    },
}));

const actor = { userId: "alice" };

const postInput = {
    title: "Backgrounds for posts",
    description: "A short description",
    content: { type: "doc", content: [] },
    tags: ["design"],
    readPerMinute: 3,
    published: true,
};

describe("post service", () => {
    beforeEach(() => {
        mockPostCreate.mockReset();
        mockPostUpdate.mockReset();
        mockPostFindMany.mockReset();
        mockPostFindUnique.mockReset();
        mockPostDelete.mockReset();
        mockUserFindUnique.mockReset();

        mockUserFindUnique.mockResolvedValue({
            name: "Alice Anderson",
            image: "https://example.com/alice.png",
            username: "alice",
        });
        mockPostCreate.mockResolvedValue({
            id: "post-1",
            titleId: "backgrounds-for-posts-ab12",
        });
        mockPostUpdate.mockResolvedValue({
            id: "post-1",
            titleId: "backgrounds-for-posts-ab12",
        });
        mockPostDelete.mockResolvedValue({ id: "post-1" });
        mockPostFindMany.mockResolvedValue([]);
    });

    it("owner-scopes the update mutation", async () => {
        await updatePost(actor, { postId: "p1", ...postInput });

        expect(mockPostUpdate.mock.calls[0][0].where).toEqual({
            id: "p1",
            userId: "alice",
        });
    });

    it("rejects an update for another user's post", async () => {
        mockPostUpdate.mockRejectedValue({ code: "P2025" });

        await expect(
            updatePost(actor, { postId: "bobs-post", ...postInput }),
        ).rejects.toThrow("Not authorized");
    });

    it("rejects a delete for another user's post", async () => {
        mockPostDelete.mockRejectedValue({ code: "P2025" });

        await expect(
            deletePost(actor, { postId: "bobs-post" }),
        ).rejects.toThrow("Not authorized");
        // The destructive query stays owner-scoped even when it fails.
        expect(mockPostDelete.mock.calls[0][0].where).toEqual({
            id: "bobs-post",
            userId: "alice",
        });
    });

    it("owner-scopes the publish mutation", async () => {
        await setPostPublished(actor, { postId: "p1", published: true });

        expect(mockPostUpdate.mock.calls[0][0].where).toEqual({
            id: "p1",
            userId: "alice",
        });
        expect(mockPostUpdate.mock.calls[0][0].data).toEqual({ published: true });
    });

    it("sets the author fields from the acting user on create", async () => {
        await createPost(actor, postInput);

        const data = mockPostCreate.mock.calls[0][0].data;
        expect(data.author).toBe("Alice Anderson");
        expect(data.authorImage).toBe("https://example.com/alice.png");
        expect(data.authorUsername).toBe("alice");
        // The row belongs to the session user, never to a request field.
        expect(data.user).toEqual({ connect: { id: "alice" } });
    });

    it("validates the customization before writing", async () => {
        await expect(
            createPost(actor, {
                ...postInput,
                customization: { backgroundColor: "#ff0000" },
            }),
        ).rejects.toThrow(/backgroundColor/);
        expect(mockPostCreate).not.toHaveBeenCalled();
    });

    it("lists only the acting user's posts by default", async () => {
        await listPosts(actor, {});

        expect(mockPostFindMany.mock.calls[0][0].where).toMatchObject({
            userId: "alice",
        });
    });

    it("lists the organization's posts to a member", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            ownerId: "bob",
            admins: [],
            members: [{ id: "alice" }],
        });
        mockPostFindMany.mockResolvedValue([]);

        await listPosts({ userId: "alice" }, { organizationId: "org-1" });

        expect(mockPostFindMany.mock.calls[0][0].where).toEqual({
            organizationId: "org-1",
        });
    });

    it("returns nothing for an organization the caller does not belong to", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            ownerId: "bob",
            admins: [],
            members: [],
        });

        const posts = await listPosts(
            { userId: "alice" },
            { organizationId: "org-1" },
        );

        expect(posts).toEqual([]);
        expect(mockPostFindMany).not.toHaveBeenCalled();
    });

    it("sorts by the requested metric", async () => {
        await listPosts(actor, { sort: "most-views" });

        expect(mockPostFindMany.mock.calls[0][0].orderBy).toEqual({
            views: { _count: "desc" },
        });
    });
});
