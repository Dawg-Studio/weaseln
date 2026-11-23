import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const { mockFindUnique, mockUpdate, mockPostUpdateMany, mockTransaction } =
    vi.hoisted(() => ({
        mockFindUnique: vi.fn(),
        mockUpdate: vi.fn(),
        mockPostUpdateMany: vi.fn(),
        mockTransaction: vi.fn(),
    }));

vi.mock("@/db", () => ({
    default: {
        user: {
            update: (...args: unknown[]) => mockUpdate(...args),
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
        },
        post: {
            updateMany: (...args: unknown[]) => mockPostUpdateMany(...args),
        },
        // The interactive transaction form: the callback runs against a tx
        // that offers the same models.
        $transaction: async (
            fn: (_tx: unknown) => Promise<unknown>,
            options?: unknown,
        ) => {
            mockTransaction(fn, options);
            return fn({
                user: {
                    update: (...args: unknown[]) => mockUpdate(...args),
                    findUnique: (...args: unknown[]) => mockFindUnique(...args),
                },
            });
        },
    },
}));

import { getOwnProfile, updateOwnProfile } from "./service";

const actor = { userId: "alice" };

describe("profile service", () => {
    beforeEach(() => {
        mockFindUnique.mockReset();
        mockUpdate.mockReset();
        mockPostUpdateMany.mockReset();
        mockTransaction.mockReset();
        mockUpdate.mockResolvedValue({ id: "alice" });
        mockFindUnique.mockResolvedValue({ socials: [] });
        mockPostUpdateMany.mockResolvedValue({ count: 0 });
    });

    it("refuses a field outside the allowlist", async () => {
        await expect(
            updateOwnProfile(actor, { skills: ["TypeScript"] }),
        ).rejects.toThrow("Unsupported field: skills");
    });

    it("refuses a resume field", async () => {
        await expect(
            updateOwnProfile(actor, { resumeUrl: "javascript:alert(1)" }),
        ).rejects.toThrow("Unsupported field: resumeUrl");
    });

    it("refuses an empty username", async () => {
        await expect(
            updateOwnProfile(actor, { username: "   " }),
        ).rejects.toThrow("username must not be empty");
    });

    it("refuses socials that are not a list of name and url", async () => {
        await expect(
            updateOwnProfile(actor, { socials: [{ name: "GitHub" }] }),
        ).rejects.toThrow("socials must be a list of { name, url } objects");
    });

    it("writes only the fields it is given", async () => {
        await updateOwnProfile(actor, { name: "Alice" });

        const call = mockUpdate.mock.calls[0]?.[0] as {
            data: Record<string, unknown>;
        };
        expect(call.data).toEqual({ name: "Alice" });
    });

    it("keeps a social the caller did not send", async () => {
        mockFindUnique.mockResolvedValue({
            socials: [
                { name: "GitHub", url: "https://github.com/alice" },
                { name: "Facebook", url: "https://old" },
            ],
        });

        await updateOwnProfile(actor, {
            socials: [{ name: "Facebook", url: "https://new" }],
        });

        const data = mockUpdate.mock.calls[0][0].data as {
            socials: { name: string; url: string }[];
        };
        expect(data.socials).toEqual([
            { name: "Facebook", url: "https://new" },
            { name: "GitHub", url: "https://github.com/alice" },
        ]);
    });

    it("reports a username that is taken as a conflict", async () => {
        mockUpdate.mockRejectedValue({ code: "P2002" });

        await expect(
            updateOwnProfile(actor, { username: "alice" }),
        ).rejects.toThrow("Username already taken");
    });

    it("names the field that is taken", async () => {
        mockUpdate.mockRejectedValue({ code: "P2002" });

        await expect(
            updateOwnProfile(actor, { username: "alice" }),
        ).rejects.toMatchObject({ status: 409, field: "username" });
    });

    it("names the email that was taken, not the username", async () => {
        mockUpdate.mockRejectedValue({
            code: "P2002",
            meta: { target: ["email"] },
        });

        await expect(
            updateOwnProfile(actor, {
                username: "alice",
                email: "taken@test.com",
            }),
        ).rejects.toMatchObject({
            status: 409,
            field: "email",
            message: "Email already taken",
        });
    });

    it("reads the email out of the Postgres constraint name", async () => {
        mockUpdate.mockRejectedValue({
            code: "P2002",
            meta: { target: ["User_email_key"] },
        });

        await expect(
            updateOwnProfile(actor, {
                username: "alice",
                email: "taken@test.com",
            }),
        ).rejects.toMatchObject({
            status: 409,
            field: "email",
            message: "Email already taken",
        });
    });

    it("names the username that was taken, not the email", async () => {
        mockUpdate.mockRejectedValue({
            code: "P2002",
            meta: { target: ["username"] },
        });

        await expect(
            updateOwnProfile(actor, {
                username: "alice",
                email: "alice@test.com",
            }),
        ).rejects.toMatchObject({
            status: 409,
            field: "username",
            message: "Username already taken",
        });
    });

    it("leaves the posts alone when the name did not change", async () => {
        await updateOwnProfile(actor, { bio: "hi" });

        expect(mockPostUpdateMany).not.toHaveBeenCalled();
    });

    it("gives the posts the new username", async () => {
        await updateOwnProfile(actor, { username: "alice2" });

        expect(mockPostUpdateMany).toHaveBeenCalledWith({
            where: { userId: "alice" },
            data: { authorUsername: "alice2" },
        });
    });

    it("returns the owner's own fields", async () => {
        mockFindUnique.mockResolvedValue({
            username: "alice",
            name: "Alice",
            bio: "hi",
            address: "Berlin",
            occupation: "Engineer",
            email: "alice@test.com",
            image: "https://img",
            skills: ["TypeScript"],
            socials: [],
        });

        const profile = await getOwnProfile(actor);

        expect(profile.username).toBe("alice");
        expect(profile.skills).toEqual(["TypeScript"]);
    });

    it("reads a null socials column as an empty list", async () => {
        mockFindUnique.mockResolvedValue({
            username: "alice",
            socials: null,
        });

        const profile = await getOwnProfile(actor);

        expect(profile.socials).toEqual([]);
    });
});
