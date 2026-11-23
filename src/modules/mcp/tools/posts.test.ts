import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPost, getPost, listPosts, updatePost } from "@/modules/posts/service";
import { listOrganizations } from "@/modules/organization/service";

import {
    handleCreatePost,
    handleGetPost,
    handleListPosts,
    handleUpdatePost,
    listPostsScopeChallenge,
} from "./posts";

vi.mock("@/modules/posts/service", () => ({
    createPost: vi.fn(),
    updatePost: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    deletePost: vi.fn(),
}));
vi.mock("@/modules/organization/service", () => ({
    listOrganizations: vi.fn(),
}));

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["posts:read", "posts:write", "org:read"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("post tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(listPosts).mockResolvedValue([]);
        vi.mocked(listOrganizations).mockResolvedValue([]);
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: { type: "doc", content: [] },
            published: true,
            readPerMinute: 3,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });
    });

    it("lists the caller's posts with the caller as the actor", async () => {
        await handleListPosts({}, context);

        expect(listPosts).toHaveBeenCalledWith(
            { userId: "alice" },
            expect.objectContaining({}),
        );
    });

    it("passes an organization filter through to the service", async () => {
        await handleListPosts({ orgId: "org-1" }, context);

        expect(listPosts).toHaveBeenCalledWith(
            { userId: "alice" },
            expect.objectContaining({ organizationId: "org-1" }),
        );
    });

    it("asks for org:read as well when an organization is named", () => {
        const challenge = listPostsScopeChallenge({
            request: { params: { arguments: { orgId: "org-1" } } },
            authInfo: { scopes: ["posts:read"] } as never,
        });

        expect(challenge?.scopes).toEqual(["posts:read", "org:read"]);
    });

    it("refuses to file a post under an organization the caller does not belong to", async () => {
        vi.mocked(listOrganizations).mockResolvedValue([]);

        const result = await handleCreatePost(
            {
                title: "A post",
                contentMarkdown: "hello",
                orgId: "org-1",
            },
            context,
        );

        expect(result.isError).toBe(true);
        expect(createPost).not.toHaveBeenCalled();
    });

    it("creates a post with the body converted from markdown", async () => {
        vi.mocked(createPost).mockResolvedValue({
            id: "post-1",
            titleId: "a-post-ab12",
            content: { type: "doc" },
        });

        await handleCreatePost(
            {
                title: "A post",
                contentMarkdown: "one two three four five",
                tags: ["design"],
            },
            context,
        );

        const input = vi.mocked(createPost).mock.calls[0][1];
        expect(input.title).toBe("A post");
        expect(input.content).toMatchObject({ type: "doc" });
        expect(input.readPerMinute).toBe(Math.round(5 / 238));
    });

    it("rejects a cover image URL outside the allowlist", async () => {
        const result = await handleCreatePost(
            {
                title: "A post",
                contentMarkdown: "hello",
                coverImageUrl: "https://evil.example.com/tracker.png",
            },
            context,
        );

        expect(result.isError).toBe(true);
        expect(createPost).not.toHaveBeenCalled();
    });

    it("rejects a background colour outside the palette", async () => {
        const result = await handleCreatePost(
            {
                title: "A post",
                contentMarkdown: "hello",
                design: { backgroundColor: "#ff0000" },
            },
            context,
        );

        expect(result.isError).toBe(true);
        expect(createPost).not.toHaveBeenCalled();
    });

    it("refuses an update that would flatten an unsupported node", async () => {
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: {
                type: "doc",
                content: [{ type: "youtube", attrs: { src: "x" } }],
            },
            published: true,
            readPerMinute: 3,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });

        const result = await handleUpdatePost(
            { id: "post-1", title: "A post", contentMarkdown: "hello" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("youtube");
        expect(updatePost).not.toHaveBeenCalled();
    });

    it("allows an update that leaves the body alone", async () => {
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: {
                type: "doc",
                content: [{ type: "youtube", attrs: { src: "x" } }],
            },
            published: true,
            readPerMinute: 3,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });
        vi.mocked(updatePost).mockResolvedValue({
            id: "post-1",
            titleId: "a-post-ab12",
            content: { type: "doc" },
        });

        const result = await handleUpdatePost(
            { id: "post-1", title: "A new title" },
            context,
        );

        expect(result.isError).toBeUndefined();
        expect(updatePost).toHaveBeenCalledTimes(1);
    });

    it("allows that update when allowFlatten is set", async () => {
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: {
                type: "doc",
                content: [{ type: "youtube", attrs: { src: "x" } }],
            },
            published: true,
            readPerMinute: 3,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });
        vi.mocked(updatePost).mockResolvedValue({
            id: "post-1",
            titleId: "a-post-ab12",
            content: { type: "doc" },
        });

        const result = await handleUpdatePost(
            {
                id: "post-1",
                title: "A post",
                contentMarkdown: "hello",
                allowFlatten: true,
            },
            context,
        );

        expect(result.isError).toBeUndefined();
        expect(updatePost).toHaveBeenCalledTimes(1);
    });

    it("reads a post back as markdown", async () => {
        vi.mocked(getPost).mockResolvedValue({
            id: "post-1",
            title: "A post",
            description: "",
            tags: [],
            content: {
                type: "doc",
                content: [
                    { type: "paragraph", content: [{ type: "text", text: "hi" }] },
                ],
            },
            published: true,
            readPerMinute: 3,
            organizationId: null,
            authorUsername: "alice",
            createdAt: new Date(),
        });

        const result = await handleGetPost({ id: "post-1" }, context);

        expect(result.content[0].text).toContain('"contentMarkdown": "hi"');
    });
});
