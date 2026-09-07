import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { DEFAULT_POST_CUSTOMIZATION } from "@/modules/post-customization/validation";

const mockAuth = vi.fn();
const mockPostFindUnique = vi.fn();
const mockPostUpsert = vi.fn();
const mockPostUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockDraftDelete = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({
    default: {
        post: {
            findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
            upsert: (...args: unknown[]) => mockPostUpsert(...args),
            update: (...args: unknown[]) => mockPostUpdate(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
        postDraft: {
            delete: (...args: unknown[]) => mockDraftDelete(...args),
        },
    },
}));
// ponytail: revalidatePath needs a Next request store that a unit test cannot
// provide. Cache invalidation is not what these tests assert, so stub it out
// rather than let it throw past the assertions.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type PostFields = Record<string, string>;

/**
 * The composer posts multipart FormData, so the tests do too. Every field the
 * route reads unconditionally has to be present or the handler throws before it
 * reaches the branch under test.
 */
function validFields(overrides: PostFields = {}): PostFields {
    return {
        title: "Backgrounds for posts",
        description: "A short description",
        tags: JSON.stringify(["design"]),
        content: JSON.stringify({ type: "doc", content: [] }),
        readPerMinute: "3",
        username: "alice",
        published: "true",
        // The composer stringifies an unpicked cover, and the route's early
        // return keys on that literal — it keeps these tests off the Cloudinary
        // path entirely.
        coverImage: "undefined",
        ...overrides,
    };
}

function postRequest(fields: PostFields): NextRequest {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
        body.append(key, value);
    }
    const req = new Request("http://localhost/api/post", {
        method: "POST",
        body,
    });
    return req as unknown as NextRequest;
}

/**
 * `POST` can fall off its own end and resolve to `undefined` (the image-rewrite
 * bail-out). A test that lands there should say so instead of reading `.status`
 * off nothing.
 */
async function callPost(fields: PostFields) {
    const res = await POST(postRequest(fields));
    if (!res) throw new Error("POST /api/post resolved without a response");
    return res;
}

function expectNoWrites() {
    expect(mockPostUpsert).not.toHaveBeenCalled();
    expect(mockPostUpdate).not.toHaveBeenCalled();
    expect(mockDraftDelete).not.toHaveBeenCalled();
}

describe("POST /api/post", () => {
    beforeEach(() => {
        mockAuth.mockReset();
        mockPostFindUnique.mockReset();
        mockPostUpsert.mockReset();
        mockPostUpdate.mockReset();
        mockUserFindUnique.mockReset();
        mockDraftDelete.mockReset();
        // The signed-in happy path: no leftover draft, and the upsert hands
        // back the shape the route selects.
        mockUserFindUnique.mockResolvedValue({ draft: null });
        mockPostUpsert.mockResolvedValue({
            id: "post-1",
            titleId: "backgrounds-for-posts-ab12",
            content: { type: "doc", content: [] },
        });
    });

    it("rejects an anonymous request with 401 and touches no row", async () => {
        mockAuth.mockResolvedValue(null);

        const res = await callPost(validFields());

        expect(res.status).toBe(401);
        expect(mockPostFindUnique).not.toHaveBeenCalled();
        expect(mockUserFindUnique).not.toHaveBeenCalled();
        expectNoWrites();
    });

    it("rejects a session with no user with 401", async () => {
        // Auth.js can hand back a session object whose `user` is absent; the
        // guard has to treat that as anonymous, not index into it.
        mockAuth.mockResolvedValue({ expires: "2030-01-01T00:00:00.000Z" });

        const res = await callPost(validFields());

        expect(res.status).toBe(401);
        expectNoWrites();
    });

    it("refuses a postId owned by somebody else with 403 and writes nothing", async () => {
        // The authorization hole this covers: the upsert keys on a
        // caller-supplied postId, so before the ownership check any signed-in
        // user could rewrite any post — including its background — by guessing
        // or reading an id out of a feed response.
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "bob" });

        const res = await callPost(
            validFields({
                postId: "bobs-post",
                title: "Hijacked",
                customization: JSON.stringify({ backgroundColor: "clay" }),
            }),
        );

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe("Forbidden");
        // Ownership is resolved from the stored row, not from anything the
        // request supplied.
        expect(mockPostFindUnique).toHaveBeenCalledTimes(1);
        expect(mockPostFindUnique.mock.calls[0][0].where).toEqual({
            id: "bobs-post",
        });
        expectNoWrites();
    });

    it("lets an author update their own post by id", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue({ userId: "alice" });

        const res = await callPost(
            validFields({
                postId: "alices-post",
                customization: JSON.stringify({ backgroundColor: "moss" }),
            }),
        );

        expect(res.status).toBe(200);
        expect(mockPostUpsert).toHaveBeenCalledTimes(1);
        expect(mockPostUpsert.mock.calls[0][0].where).toEqual({
            id: "alices-post",
        });
    });

    it("persists a valid customization payload on both branches of the upsert", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue(null);

        const res = await callPost(
            validFields({
                customization: JSON.stringify({
                    backgroundColor: "moss",
                    backgroundPattern: "dots",
                    backgroundImage: "/covers/cover-1.svg",
                    backgroundFit: "tile",
                }),
            }),
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBe("backgrounds-for-posts-ab12");

        expect(mockPostUpsert).toHaveBeenCalledTimes(1);
        const args = mockPostUpsert.mock.calls[0][0];
        const expected = {
            backgroundColor: "moss",
            backgroundPattern: "dots",
            backgroundImage: "/covers/cover-1.svg",
            backgroundFit: "tile",
        };
        // The four columns are scalars, so they sit directly on the payload —
        // no nested create/connect.
        expect(args.create).toMatchObject(expected);
        expect(args.update).toMatchObject(expected);
        // The row still belongs to the session user, never to a request field.
        expect(args.create.user.connect).toEqual({ id: "alice" });
    });

    it("fills the unsent fields of a partial payload with the module defaults", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue(null);

        const res = await callPost(
            validFields({
                customization: JSON.stringify({ backgroundColor: "fog" }),
            }),
        );

        expect(res.status).toBe(200);
        const args = mockPostUpsert.mock.calls[0][0];
        expect(args.update).toMatchObject({
            ...DEFAULT_POST_CUSTOMIZATION,
            backgroundColor: "fog",
        });
    });

    it("rejects an unsupported palette slug with 400 and writes nothing", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });

        const res = await callPost(
            validFields({
                // A CSS colour is exactly what a post must never store: the
                // column holds a palette slug so the stylesheet can supply a
                // light/dark pair.
                customization: JSON.stringify({ backgroundColor: "#ff0000" }),
            }),
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("backgroundColor");
        expectNoWrites();
    });

    it("rejects an unsupported pattern slug with 400", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });

        const res = await callPost(
            validFields({
                customization: JSON.stringify({
                    backgroundPattern: "stripes",
                }),
            }),
        );

        expect(res.status).toBe(400);
        expectNoWrites();
    });

    it("rejects a hostile backgroundImage URL with 400 and writes nothing", async () => {
        // The stored URL is interpolated into a CSS `url("…")` token, so a
        // breakout attempt, a foreign origin and a data: payload all have to
        // die at the route rather than at render time.
        const hostile = [
            'javascript:alert("xss")',
            "https://evil.example.com/tracker.png",
            "//evil.example.com/tracker.png",
            "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
            '/covers/a.svg");background:url("https://evil.example.com/x.png',
        ];

        for (const backgroundImage of hostile) {
            mockAuth.mockResolvedValue({ user: { id: "alice" } });

            const res = await callPost(
                validFields({
                    customization: JSON.stringify({ backgroundImage }),
                }),
            );

            expect(res.status, `expected 400 for ${backgroundImage}`).toBe(400);
            const body = await res.json();
            expect(body.error).toContain("backgroundImage");
            expectNoWrites();
        }
    });

    it("rejects a customization field that is not valid JSON with 400", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });

        const res = await callPost(
            validFields({ customization: "{ not json" }),
        );

        expect(res.status).toBe(400);
        expectNoWrites();
    });

    it("still succeeds with no customization field and leaves the columns to their defaults", async () => {
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue(null);

        const fields = validFields();
        expect(fields.customization).toBeUndefined();
        const res = await callPost(fields);

        expect(res.status).toBe(200);
        expect(mockPostUpsert).toHaveBeenCalledTimes(1);
        const args = mockPostUpsert.mock.calls[0][0];
        // A client that predates this feature sends no field, so the route
        // contributes no keys and the schema `@default`s write the default
        // customization on create — while an existing row keeps the background
        // it already has. Either way the post renders exactly as it did before.
        for (const column of Object.keys(DEFAULT_POST_CUSTOMIZATION)) {
            expect(args.create).not.toHaveProperty(column);
            expect(args.update).not.toHaveProperty(column);
        }
    });

    it('treats the literal string "undefined" as no customization', async () => {
        // The composer stringifies optional fields, so an unpicked background
        // arrives as "undefined" rather than as an absent field.
        mockAuth.mockResolvedValue({ user: { id: "alice" } });
        mockPostFindUnique.mockResolvedValue(null);

        const res = await callPost(validFields({ customization: "undefined" }));

        expect(res.status).toBe(200);
        const args = mockPostUpsert.mock.calls[0][0];
        for (const column of Object.keys(DEFAULT_POST_CUSTOMIZATION)) {
            expect(args.update).not.toHaveProperty(column);
        }
    });
});
