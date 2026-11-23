import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@/generated/prisma/client";
import ProfileSettingsComponent from "./Profile";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/utils/actions/verification", () => ({
    generateVerificationCode: vi.fn(),
    getCurrentEmailVerificationCodeDate: vi.fn(async () => null),
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 200 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
});

const user = {
    id: "alice",
    username: "alice",
    name: "Alice",
    bio: "hi",
    address: "",
    occupation: "",
    email: "alice@test.com",
    emailVerified: new Date(),
    image: "https://example.com/alice.png",
    socials: [
        { name: "GitHub", url: "https://github.com/alice" },
        { name: "Facebook", url: "https://facebook.com/alice" },
    ],
} as unknown as User;

describe("profile settings", () => {
    it("tells the owner when the server refuses the save for another reason", async () => {
        const { toast } = await import("react-hot-toast");
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({
                error: "socials must be a list of { name, url } objects",
            }),
        });
        render(<ProfileSettingsComponent {...user} />);

        await userEvent.click(
            screen.getByRole("button", { name: /update profile information/i }),
        );

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(toast.error).toHaveBeenCalledWith(
            "socials must be a list of { name, url } objects",
        );
    });

    it("opens the form when the socials column holds an entry it cannot read", () => {
        const broken = {
            ...user,
            socials: [null, { name: "Facebook", url: "https://fb" }],
        } as unknown as typeof user;

        render(<ProfileSettingsComponent {...broken} />);

        expect(screen.getByLabelText("Facebook")).toHaveValue("https://fb");
    });

    it("does not offer a social the profile cannot render for editing", () => {
        const broken = {
            ...user,
            socials: [{ name: "Facebook", url: 123 }],
        } as unknown as typeof user;

        render(<ProfileSettingsComponent {...broken} />);

        expect(screen.getByLabelText("Facebook")).toHaveValue("");
    });

    it("sends only the social fields the owner changed", async () => {
        render(<ProfileSettingsComponent {...user} />);

        const facebook = screen.getByLabelText("Facebook");
        await userEvent.clear(facebook);
        await userEvent.type(facebook, "https://new");
        await userEvent.click(
            screen.getByRole("button", { name: /update profile information/i }),
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(
            (fetchMock.mock.calls[0][1] as RequestInit).body as string,
        ) as { socials: { name: string; url: string }[] };
        // The server keeps the socials it was not told about, so the form
        // sends only what the owner actually changed.
        expect(body.socials).toEqual([
            { name: "Facebook", url: "https://new" },
        ]);
    });
});
