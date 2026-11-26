import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import McpSetup from "./McpSetup";

vi.mock("react-hot-toast", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const ENDPOINT = "https://weaseln.blog/api/mcp";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

describe("McpSetup", () => {
    it("shows the endpoint it was given and copies it", async () => {
        render(<McpSetup endpoint={ENDPOINT} />);

        expect(screen.getByText(ENDPOINT)).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /copy the mcp endpoint url/i }),
        );

        expect(writeText).toHaveBeenCalledWith(ENDPOINT);
    });

    it("copies a configuration that points at the endpoint without a key", async () => {
        render(<McpSetup endpoint={ENDPOINT} />);

        await userEvent.click(
            screen.getByRole("button", {
                name: /copy the mcp client configuration/i,
            }),
        );

        const copied = writeText.mock.calls[0][0] as string;
        expect(copied).toContain(`"url": "${ENDPOINT}"`);
        expect(copied).not.toContain("client_secret");
        expect(copied).not.toContain("client_id");
        expect(copied).not.toContain('"oauth"');
    });

    it("copies the registered-client configuration with its placeholders", async () => {
        render(<McpSetup endpoint={ENDPOINT} />);

        await userEvent.click(
            screen.getByRole("button", {
                name: /copy the registered-client configuration/i,
            }),
        );

        const copied = writeText.mock.calls[0][0] as string;
        expect(copied).toContain(`"url": "${ENDPOINT}"`);
        expect(copied).toContain('"client_id": "<client id>"');
        expect(copied).toContain('"client_secret": "<client secret>"');
    });

    it("says so when the clipboard refuses", async () => {
        const { toast } = await import("react-hot-toast");
        writeText.mockRejectedValue(new Error("denied"));

        render(<McpSetup endpoint={ENDPOINT} />);

        await userEvent.click(
            screen.getByRole("button", { name: /copy the mcp endpoint url/i }),
        );

        expect(toast.error).toHaveBeenCalled();
    });

    it("lists every permission the server knows", () => {
        render(<McpSetup endpoint={ENDPOINT} />);

        for (const scope of [
            "posts:read",
            "posts:write",
            "org:read",
            "org:write",
            "design:read",
            "design:write",
            "profile:read",
            "profile:write",
            "portfolio:read",
            "portfolio:write",
        ]) {
            expect(screen.getByText(scope)).toBeInTheDocument();
        }
    });
});
