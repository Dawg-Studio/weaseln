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

    it("reports an error that carries a caller status as it is", () => {
        const error = Object.assign(new Error("Resume must be a PDF"), {
            status: 415,
        });

        const result = toolError(error);

        expect(result.content[0].text).toBe("Resume must be a PDF");
        expect(result.isError).toBe(true);
    });

    it("keeps a server status internal", () => {
        const error = Object.assign(new Error("Upload failed"), { status: 502 });

        const result = toolError(error);

        expect(result.content[0].text).toBe("Internal server error");
    });

    it("reports a portfolio validation error as it is", () => {
        const result = toolError(
            new Error("Invalid portfolio input: gallery holds at most 12 images"),
        );

        expect(result.content[0].text).toContain("Invalid portfolio input");
    });

    it("reports a missing portfolio row as it is", () => {
        const result = toolError(new Error("Showcase not found"));

        expect(result.content[0].text).toBe("Showcase not found");
    });
});
