import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "@/components/wysiwyg/hooks/useAutosave";

describe("useAutosave", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("debounces and calls onSave with the content", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useAutosave({ onSave, delayMs: 1000 }),
        );

        act(() => {
            result.current.save("hello");
        });

        expect(onSave).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(onSave).toHaveBeenCalledWith("hello");
        expect(result.current.status).toBe("saved");
    });

    it("resets the timer when called again before the delay", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useAutosave({ onSave, delayMs: 1000 }),
        );

        act(() => {
            result.current.save("first");
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        act(() => {
            result.current.save("second");
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });

        expect(onSave).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith("second");
    });
});
