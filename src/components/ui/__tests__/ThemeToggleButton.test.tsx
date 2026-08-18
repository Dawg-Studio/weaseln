import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
    })),
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("next-auth/react", () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    useSession: () => ({ data: null, status: "unauthenticated" }),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggleButton } from "../Navigation";

describe("ThemeToggleButton", () => {
    beforeEach(() => {
        cleanup();
        document.documentElement.dataset.theme = "light";
    });

    it("renders a button with the dark-mode switch label when current theme is light", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        expect(
            screen.getByRole("button", { name: /switch to dark theme/i }),
        ).toBeInTheDocument();
    });

    it("renders a button with the light-mode switch label when current theme is dark", () => {
        document.documentElement.dataset.theme = "dark";
        render(<ThemeToggleButton />);
        expect(
            screen.getByRole("button", { name: /switch to light theme/i }),
        ).toBeInTheDocument();
    });

    it("sets data-set-theme to the opposite of the current theme", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        const btn = screen.getByRole("button", { name: /switch to dark theme/i });
        expect(btn.dataset.setTheme).toBe("dark");

        cleanup();
        document.documentElement.dataset.theme = "dark";
        render(<ThemeToggleButton />);
        const btn2 = screen.getByRole("button", { name: /switch to light theme/i });
        expect(btn2.dataset.setTheme).toBe("light");
    });

    it("does not throw when clicked", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        const btn = screen.getByRole("button", { name: /switch to dark theme/i });
        expect(() => fireEvent.click(btn)).not.toThrow();
    });
});
