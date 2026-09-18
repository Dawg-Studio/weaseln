"use client";

import { useCallback, useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "light";
export const THEME_STORAGE_KEY = "theme";

export function isTheme(value: unknown): value is Theme {
    return value === "light" || value === "dark";
}

export function getActiveTheme(): Theme {
    if (typeof document === "undefined") return DEFAULT_THEME;

    const current = document.documentElement.dataset.theme;
    return isTheme(current) ? current : DEFAULT_THEME;
}

export function getStoredTheme(): Theme | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isTheme(stored) ? stored : null;
    } catch {
        return null;
    }
}

export function applyTheme(theme: Theme, persist = true) {
    if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = theme;
    }

    if (persist && typeof window !== "undefined") {
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // The visible theme should still change when storage is unavailable.
        }
    }
}

export function useTheme() {
    // Keep the server and first client render identical. The layout effect syncs
    // this state with the pre-hydration script before the browser paints.
    const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

    useLayoutEffect(() => {
        const root = document.documentElement;
        const syncFromDocument = () => setThemeState(getActiveTheme());

        syncFromDocument();

        const observer = new MutationObserver(syncFromDocument);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    const setTheme = useCallback((nextTheme: Theme) => {
        setThemeState(nextTheme);
        applyTheme(nextTheme);
    }, []);

    return { theme, setTheme };
}
