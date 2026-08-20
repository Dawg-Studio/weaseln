"use client";

import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { themeChange } from "theme-change";

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState<string>(() =>
        typeof window !== "undefined"
            ? (localStorage.getItem("theme") as string) ?? ""
            : "",
    );
    useEffect(() => {
        themeChange(false);
        // 👆 false parameter is required for react project
    }, []);

    return (
        <>
            {theme === "dark" ? (
                <button
                    className="btn btn-neutral"
                    data-set-theme="light"
                    onClick={() => setTheme("light")}
                >
                    <FontAwesomeIcon icon={faSun} />
                </button>
            ) : (
                <button
                    className="btn btn-neutral"
                    data-set-theme="dark"
                    onClick={() => setTheme("dark")}
                >
                    <FontAwesomeIcon icon={faMoon} />
                </button>
            )}
        </>
    );
}
