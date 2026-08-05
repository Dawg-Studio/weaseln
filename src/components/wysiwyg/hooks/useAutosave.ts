"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave({
    onSave,
    delayMs = 5000,
}: {
    onSave: (_content: string) => Promise<void>;
    delayMs?: number;
}) {
    const [status, setStatus] = useState<AutosaveStatus>("idle");
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const save = useCallback(
        (content: string) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(async () => {
                setStatus("saving");
                try {
                    await onSave(content);
                    setStatus("saved");
                } catch {
                    setStatus("error");
                }
            }, delayMs);
        },
        [onSave, delayMs],
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return { save, status };
}
