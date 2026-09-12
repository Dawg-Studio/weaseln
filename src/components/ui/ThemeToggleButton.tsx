"use client";

import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/utils/cn";

export default function ThemeToggleButton({
    className,
}: {
    className?: string;
}) {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";

    return (
        <label
            className={cn(
                "swap swap-rotate group",
                className ?? "btn btn-neutral btn-square",
            )}
            title={label}
        >
            <input
                type="checkbox"
                className="theme-controller"
                value="dark"
                checked={isDark}
                aria-label={label}
                onChange={(event) =>
                    setTheme(event.currentTarget.checked ? "dark" : "light")
                }
            />
            <FontAwesomeIcon
                icon={faSun}
                aria-hidden="true"
                className="swap-on transition-transform duration-300 ease-burrow group-hover:rotate-[18deg]"
            />
            <FontAwesomeIcon
                icon={faMoon}
                aria-hidden="true"
                className="swap-off transition-transform duration-300 ease-burrow group-hover:rotate-[18deg]"
            />
        </label>
    );
}
