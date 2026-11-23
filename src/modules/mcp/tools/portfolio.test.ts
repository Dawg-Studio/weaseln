import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    applyResumeProposal,
    getResumeState,
    removeResume,
    setResumeVisibility,
    uploadResume,
} from "@/modules/portfolio/resume";

import {
    handleApplyResume,
    handleDeleteResume,
    handleGetResume,
    handleSetResumeVisibility,
    handleUploadResume,
} from "./portfolio";

vi.mock("@/modules/portfolio/resume", () => ({
    getResumeState: vi.fn(),
    uploadResume: vi.fn(),
    applyResumeProposal: vi.fn(),
    setResumeVisibility: vi.fn(),
    removeResume: vi.fn(),
}));

const base64Pdf = Buffer.from("%PDF-1.7 fake").toString("base64");

const proposal = {
    headline: "Engineer",
    summary: "Builds things",
    location: "Berlin",
    links: [{ label: "GitHub", url: "https://github.com/alice" }],
    skills: ["TypeScript"],
    experience: [],
};

const context = {
    http: {
        authInfo: {
            token: "token",
            clientId: "client-1",
            scopes: ["portfolio:read", "portfolio:write", "profile:write"],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            resource: new URL("https://weaseln.example.com/api/mcp"),
            extra: { userId: "alice" },
        },
    },
};

describe("resume tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getResumeState).mockResolvedValue({
            hasResume: true,
            isPublic: false,
            downloadUrl: "https://api.cloudinary.com/v1_1/demo/raw/download?signed",
        });
        vi.mocked(uploadResume).mockResolvedValue({
            url: "https://res.cloudinary.com/demo/raw/private/v1/portfolio/alice-1.pdf",
            proposal,
            error: null,
        });
        vi.mocked(applyResumeProposal).mockResolvedValue({ experience: 0 });
    });

    it("reads the resume of the caller", async () => {
        const result = await handleGetResume({}, context);

        expect(getResumeState).toHaveBeenCalledWith({ userId: "alice" });
        expect(JSON.parse(result.content[0].text).data.hasResume).toBe(true);
    });

    it("uploads the pdf and returns the proposal without writing it", async () => {
        const result = await handleUploadResume({ data: base64Pdf }, context);

        expect(uploadResume).toHaveBeenCalledWith(
            { userId: "alice" },
            { bytes: expect.any(Uint8Array) },
        );
        expect(applyResumeProposal).not.toHaveBeenCalled();
        expect(
            JSON.parse(result.content[0].text).data.proposal.headline,
        ).toBe("Engineer");
    });

    it("keeps the file when the parser could not read it", async () => {
        vi.mocked(uploadResume).mockResolvedValue({
            url: "https://res.cloudinary.com/demo/raw/private/v1/portfolio/alice-1.pdf",
            proposal: null,
            error: "Could not read this resume",
        });

        const result = await handleUploadResume({ data: base64Pdf }, context);

        const body = JSON.parse(result.content[0].text).data;
        expect(body.error).toBe("Could not read this resume");
        expect(body.url).toContain("alice-1.pdf");
    });

    it("passes the confirmed facts through unchanged", async () => {
        const facts = {
            headline: "Engineer",
            summary: null,
            location: null,
            links: [],
            skills: ["TypeScript"],
            experience: [],
        };

        await handleApplyResume(facts, context);

        expect(applyResumeProposal).toHaveBeenCalledWith(
            { userId: "alice" },
            facts,
        );
    });

    it("reports a portfolio validation error as it is", async () => {
        vi.mocked(applyResumeProposal).mockRejectedValue(
            new Error(
                "Invalid portfolio input: links.url must be an http or https URL",
            ),
        );

        const result = await handleApplyResume(
            {
                headline: null,
                summary: null,
                location: null,
                links: [],
                skills: [],
                experience: [],
            },
            context,
        );

        expect(result.content[0].text).toContain("Invalid portfolio input");
        expect(result.isError).toBe(true);
    });

    it("makes the resume public", async () => {
        await handleSetResumeVisibility({ isPublic: true }, context);

        expect(setResumeVisibility).toHaveBeenCalledWith(
            { userId: "alice" },
            { isPublic: true },
        );
    });

    it("deletes the resume", async () => {
        await handleDeleteResume({}, context);

        expect(removeResume).toHaveBeenCalledWith({ userId: "alice" });
    });
});
