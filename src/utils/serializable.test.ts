import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
    default: {
        $transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

import { serializable } from "./serializable";

const conflict = () =>
    Object.assign(new Error("could not serialize access"), { code: "P2034" });

describe("serializable", () => {
    beforeEach(() => {
        mockTransaction.mockReset();
    });

    it("runs the write at the serializable isolation level", async () => {
        mockTransaction.mockResolvedValueOnce("done");

        const result = await serializable(async () => "done");

        expect(result).toBe("done");
        expect(mockTransaction.mock.calls[0][1]).toMatchObject({
            isolationLevel: "Serializable",
        });
    });

    it("retries a serialization failure instead of losing the write", async () => {
        mockTransaction
            .mockRejectedValueOnce(conflict())
            .mockResolvedValueOnce("done");

        expect(await serializable(async () => "done")).toBe("done");
        expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it("gives up after three attempts", async () => {
        mockTransaction.mockRejectedValue(conflict());

        await expect(serializable(async () => "done")).rejects.toThrow(
            "could not serialize access",
        );
        expect(mockTransaction).toHaveBeenCalledTimes(3);
    });

    it("does not retry an error that is not a conflict", async () => {
        mockTransaction.mockRejectedValue(new Error("boom"));

        await expect(serializable(async () => "done")).rejects.toThrow("boom");
        expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
});
