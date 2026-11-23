import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShowcaseEditor from "./ShowcaseEditor";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    // The toast mock is shared by every test in this file, so its calls have
    // to be cleared or a later test passes on an earlier test's toast.
    vi.clearAllMocks();
    fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 200 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
});

const showcase = {
    id: "s1",
    title: "Photography",
    slug: "photography",
    description: null,
    layout: "gallery" as const,
};

const item = {
    id: "i1",
    slug: "harbour",
    title: "Harbour",
    summary: null,
    description: null,
    coverImage: null,
    gallery: [],
    link: null,
    tags: [],
    date: null,
};

describe("ShowcaseEditor", () => {
    it("keeps the item when the request fails outright", async () => {
        const { toast } = await import("react-hot-toast");
        fetchMock.mockRejectedValueOnce(new Error("network down"));
        render(
            <ShowcaseEditor
                showcase={showcase}
                items={[item]}
                userId="alice"
                username="alice"
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: /delete harbour/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(screen.getByText("Harbour")).toBeInTheDocument();
    });

    it("keeps the item when the server refuses the delete", async () => {
        const { toast } = await import("react-hot-toast");
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: "Item not found" }),
        });
        render(
            <ShowcaseEditor
                showcase={showcase}
                items={[item]}
                userId="alice"
                username="alice"
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: /delete harbour/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(screen.getByText("Harbour")).toBeInTheDocument();
    });
});
