import { describe, expect, it } from "vitest";
import { assertResumeBytes, parseResumePdf, ResumeError } from "./resume";
import { MAX_RESUME_BYTES } from "./types";

const pdf = () => new TextEncoder().encode("%PDF-1.4\n1 0 obj\n");

const validProposal = {
    headline: "Software engineer",
    summary: "Builds things",
    location: "Berlin",
    links: [{ label: "GitHub", url: "https://github.com/alice" }],
    skills: ["TypeScript"],
    experience: [
        { kind: "work", org: "Acme", role: "Engineer", location: null, startDate: "2021-01", endDate: null, isCurrent: true, description: "- shipped" },
    ],
};

describe("resume bytes", () => {
    it("rejects bytes that are not a PDF", () => {
        expect(() => assertResumeBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(ResumeError);
    });

    it("rejects a resume above 5 MiB", () => {
        const big = new Uint8Array(MAX_RESUME_BYTES + 1);
        big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
        expect(() => assertResumeBytes(big)).toThrow(/5 MiB/);
    });

    it("rejects a part that claims to be a PNG", () => {
        expect(() => assertResumeBytes(pdf(), "image/png")).toThrow(/PDF/);
    });
});

describe("parseResumePdf", () => {
    it("maps a well-formed model response to a proposal", async () => {
        const proposal = await parseResumePdf(pdf(), { generate: async () => JSON.stringify(validProposal) });
        expect(proposal.experience[0].org).toBe("Acme");
        expect(proposal.skills).toEqual(["TypeScript"]);
    });

    it("throws rather than partially mapping a malformed response", async () => {
        await expect(
            parseResumePdf(pdf(), { generate: async () => JSON.stringify({ ...validProposal, experience: "nope" }) }),
        ).rejects.toThrow(/experience/);
    });

    it("throws on a non-JSON model response", async () => {
        await expect(parseResumePdf(pdf(), { generate: async () => "I cannot read this" })).rejects.toThrow(
            /could not read/i,
        );
    });
});
