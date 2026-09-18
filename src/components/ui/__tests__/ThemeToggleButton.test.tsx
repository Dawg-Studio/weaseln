import { beforeEach, describe, expect, it } from "vitest";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import ThemeProvider from "@/components/provider/ThemeProvider";
import ThemeToggleButton from "../ThemeToggleButton";

describe("ThemeToggleButton", () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.dataset.theme = "light";
    });

    it("switches both the document and persisted theme in either direction", () => {
        render(
            <>
                <ThemeProvider />
                <ThemeToggleButton />
            </>,
        );

        fireEvent.click(
            screen.getByRole("checkbox", { name: /switch to dark theme/i }),
        );

        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
        expect(window.localStorage.getItem("theme")).toBe("dark");

        fireEvent.click(
            screen.getByRole("checkbox", { name: /switch to light theme/i }),
        );

        expect(document.documentElement).toHaveAttribute("data-theme", "light");
        expect(window.localStorage.getItem("theme")).toBe("light");
    });

    it("restores a saved dark theme before interaction", () => {
        window.localStorage.setItem("theme", "dark");

        render(
            <>
                <ThemeProvider />
                <ThemeToggleButton />
            </>,
        );

        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
        expect(
            screen.getByRole("checkbox", { name: /switch to light theme/i }),
        ).toBeChecked();
    });

    it("keeps its initial markup stable when the browser is already dark", () => {
        window.localStorage.setItem("theme", "dark");
        document.documentElement.dataset.theme = "dark";

        const markup = renderToString(<ThemeToggleButton />);

        expect(markup).toContain('aria-label="Switch to dark theme"');
    });

    it("falls back to light when storage contains an unsupported value", () => {
        window.localStorage.setItem("theme", "sepia");

        render(
            <>
                <ThemeProvider />
                <ThemeToggleButton />
            </>,
        );

        expect(document.documentElement).toHaveAttribute("data-theme", "light");
        expect(
            screen.getByRole("checkbox", { name: /switch to dark theme/i }),
        ).not.toBeChecked();
    });

    it("keeps every mounted theme control synchronized", async () => {
        render(
            <>
                <ThemeProvider />
                <ThemeToggleButton />
                <ThemeToggleButton />
            </>,
        );

        const toggles = screen.getAllByRole("checkbox", {
            name: /switch to dark theme/i,
        });
        fireEvent.click(toggles[0]);

        await waitFor(() => {
            expect(
                screen.getAllByRole("checkbox", {
                    name: /switch to light theme/i,
                }),
            ).toHaveLength(2);
        });

        act(() => {
            document.documentElement.dataset.theme = "light";
        });

        await waitFor(() => {
            expect(
                screen.getAllByRole("checkbox", {
                    name: /switch to dark theme/i,
                }),
            ).toHaveLength(2);
        });
    });
});
