import { describe, expect, it } from "vitest";

import { toolError } from "./shared";

describe("tool errors", () => {
    it("reports a caller error as it is", () => {
        const result = toolError(new Error("Not authorized"));

        expect(result.content[0].text).toBe("Not authorized");
        expect(result.isError).toBe(true);
    });

    it("reports a validation error as it is", () => {
        const result = toolError(
            new Error("Invalid profile customization: preset must be one of"),
        );

        expect(result.content[0].text).toContain("Invalid profile");
    });

    it("reports an internal failure without its detail", () => {
        const result = toolError(
            new Error(
                "Invalid `prisma.post.create()` invocation: Unique constraint failed",
            ),
        );

        expect(result.content[0].text).toBe("Internal server error");
        expect(result.content[0].text).not.toContain("prisma");
    });
});
