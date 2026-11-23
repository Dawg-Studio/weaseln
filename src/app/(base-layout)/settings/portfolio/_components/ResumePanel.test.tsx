import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResumePanel from "./ResumePanel";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const proposal = {
    headline: "Engineer",
    summary: null,
    location: null,
    links: [],
    skills: ["TypeScript"],
    experience: [
        { kind: "work", org: "Acme", role: "Dev", location: null, startDate: "2021-01", endDate: null, isCurrent: true, description: null },
        { kind: "work", org: "Old Co", role: "Intern", location: null, startDate: "2019-06", endDate: "2019-09", isCurrent: false, description: null },
    ],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
        if (url === "/api/portfolio/resume") {
            return {
                ok: true,
                status: 201,
                json: async () => ({ url: "https://res.cloudinary.com/r.pdf", proposal, error: null }),
            };
        }
        return { ok: true, status: 201, json: async () => ({ experience: 1 }) };
    });
    vi.stubGlobal("fetch", fetchMock);
});

async function uploadAndOpenProposal() {
    render(<ResumePanel initialPublic={false} hasResume={false} />);
    await userEvent.upload(
        screen.getByLabelText(/resume pdf/i),
        new File(["%PDF-1.4"], "r.pdf", { type: "application/pdf" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /upload and read/i }));
    await screen.findByLabelText(/Old Co/);
}

describe("ResumePanel", () => {
    it("submits only the experience rows the owner left checked", async () => {
        await uploadAndOpenProposal();

        await userEvent.click(screen.getByLabelText(/Old Co/));
        await userEvent.click(screen.getByRole("button", { name: /add 1 entry/i }));

        const applyCall = fetchMock.mock.calls.find(
            ([url]) => url === "/api/portfolio/resume/apply",
        );
        expect(applyCall).toBeDefined();
        const payload = JSON.parse(applyCall![1].body as string) as {
            experience: { org: string }[];
        };
        expect(payload.experience).toHaveLength(1);
        expect(payload.experience[0].org).toBe("Acme");
    });

    it("writes nothing until the owner applies the proposal", async () => {
        await uploadAndOpenProposal();

        const writes = fetchMock.mock.calls.filter(
            ([url]) => url === "/api/portfolio/resume/apply",
        );
        expect(writes).toHaveLength(0);
    });

    it("sends the public toggle as a boolean", async () => {
        render(<ResumePanel initialPublic={false} hasResume />);
        await userEvent.click(
            screen.getByRole("checkbox", { name: /show a download link/i }),
        );

        const patch = fetchMock.mock.calls.find(
            ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        );
        expect(patch).toBeDefined();
        expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({
            isPublic: true,
        });
    });
});
