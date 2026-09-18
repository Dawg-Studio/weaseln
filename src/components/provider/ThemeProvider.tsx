"use client";

import { useLayoutEffect } from "react";
import {
    applyTheme,
    DEFAULT_THEME,
    getStoredTheme,
    isTheme,
    THEME_STORAGE_KEY,
} from "@/hooks/useTheme";

export default function ThemeProvider() {
    useLayoutEffect(() => {
        // React Strict Mode can restore the server's light attribute during its
        // development remount. Reapply the saved value before paint.
        applyTheme(getStoredTheme() ?? DEFAULT_THEME, false);

        const syncAcrossTabs = (event: StorageEvent) => {
            if (event.key !== THEME_STORAGE_KEY) return;
            applyTheme(
                isTheme(event.newValue) ? event.newValue : DEFAULT_THEME,
                false,
            );
        };

        window.addEventListener("storage", syncAcrossTabs);
        return () => window.removeEventListener("storage", syncAcrossTabs);
    }, []);

    return null;
}
