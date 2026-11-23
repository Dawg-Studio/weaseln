import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExperienceList, { type ExperienceRow } from "./ExperienceList";

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
        status: 201,
        json: async () => ({ id: "e1" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
});

const row: ExperienceRow = {
    id: "e1",
    kind: "work",
    org: "Acme",
    role: "Dev",
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
    order: 0,
};

describe("ExperienceList", () => {
    it("shows a new entry without waiting for a refetch", async () => {
        render(<ExperienceList initial={[]} />);

        await userEvent.type(screen.getByLabelText(/^organisation$/i), "Acme");
        await userEvent.type(screen.getByLabelText(/^role$/i), "Dev");
        await userEvent.click(screen.getByRole("button", { name: /add entry/i }));

        expect(await screen.findByText("Dev · Acme")).toBeInTheDocument();
    });

    it("shows rows the server added after a refresh", () => {
        const { rerender } = render(<ExperienceList initial={[]} />);

        rerender(<ExperienceList initial={[row]} />);

        expect(screen.getByText("Dev · Acme")).toBeInTheDocument();
    });

    it("keeps the row when the server refuses the delete", async () => {
        const { toast } = await import("react-hot-toast");
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: "Experience not found" }),
        });
        render(<ExperienceList initial={[row]} />);

        await userEvent.click(screen.getByRole("button", { name: /delete acme/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(screen.getByText("Dev · Acme")).toBeInTheDocument();
    });

    it("keeps the row when the request fails outright", async () => {
        const { toast } = await import("react-hot-toast");
        fetchMock.mockRejectedValueOnce(new Error("network down"));
        render(<ExperienceList initial={[row]} />);

        await userEvent.click(screen.getByRole("button", { name: /delete acme/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(screen.getByText("Dev · Acme")).toBeInTheDocument();
    });

    it("keeps the end date when a current role is unticked", async () => {
        render(<ExperienceList initial={[{ ...row, endDate: "2021-05" }]} />);

        await userEvent.click(screen.getByRole("button", { name: /edit acme/i }));
        await userEvent.click(screen.getByLabelText(/current role/i));
        await userEvent.click(screen.getByLabelText(/current role/i));
        await userEvent.click(screen.getByRole("button", { name: /save entry/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const body = JSON.parse(
            (fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string,
        ) as { endDate: string | null };
        expect(body.endDate).toBe("2021-05");
    });

    it("shows the edited role in place", async () => {        render(<ExperienceList initial={[row]} />);

        await userEvent.click(screen.getByRole("button", { name: /edit acme/i }));
        const roleInput = screen.getByLabelText(/^role$/i);
        await userEvent.clear(roleInput);
        await userEvent.type(roleInput, "Staff");
        await userEvent.click(screen.getByRole("button", { name: /save entry/i }));

        expect(await screen.findByText("Staff · Acme")).toBeInTheDocument();
        expect(screen.queryByText("Dev · Acme")).toBeNull();
    });
});
