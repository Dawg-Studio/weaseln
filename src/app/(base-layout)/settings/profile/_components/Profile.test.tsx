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
    it("sends only the social fields the form owns", async () => {
        render(<ProfileSettingsComponent {...user} />);

        await userEvent.click(
            screen.getByRole("button", { name: /update profile information/i }),
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(
            (fetchMock.mock.calls[0][1] as RequestInit).body as string,
        ) as { socials: { name: string }[] };
        // The server keeps the socials the caller did not send, so the form
        // must not send a stale copy of them.
        expect(body.socials.map((entry) => entry.name)).toEqual([
            "Facebook",
            "Twitter",
            "Personal Website",
        ]);
    });
});
