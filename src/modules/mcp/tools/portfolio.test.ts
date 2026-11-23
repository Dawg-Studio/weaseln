import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    createItem,
    createShowcase,
    deleteItem,
    deleteShowcase,
    listExperience,
    listPortfolio,
    listShowcases,
    moveItem,
    moveShowcase,
    updateItem,
    updateShowcase,
} from "@/modules/portfolio/service";
import {
    applyResumeProposal,
    getResumeState,
    removeResume,
    setResumeVisibility,
    uploadResume,
} from "@/modules/portfolio/resume";

import {
    handleApplyResume,
    handleCreateItem,
    handleCreateShowcase,
    handleDeleteItem,
    handleDeleteResume,
    handleDeleteShowcase,
    handleGetResume,
    handleListPortfolio,
    handleMoveItem,
    handleMoveShowcase,
    handleSetResumeVisibility,
    handleUpdateItem,
    handleUpdateShowcase,
    handleUploadResume,
} from "./portfolio";

vi.mock("@/modules/portfolio/resume", () => ({
    getResumeState: vi.fn(),
    uploadResume: vi.fn(),
    applyResumeProposal: vi.fn(),
    setResumeVisibility: vi.fn(),
    removeResume: vi.fn(),
}));

vi.mock("@/modules/portfolio/service", () => ({
    listPortfolio: vi.fn(),
    listShowcases: vi.fn(),
    createShowcase: vi.fn(),
    updateShowcase: vi.fn(),
    deleteShowcase: vi.fn(),
    moveShowcase: vi.fn(),
    listExperience: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    moveItem: vi.fn(),
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

const showcaseRow = {
    id: "showcase-1",
    title: "Work",
    slug: "work",
    description: null,
    layout: "grid" as const,
    order: 0,
};

const itemRow = {
    id: "item-1",
    title: "Harbour",
    summary: "A harbour at dusk",
    description: null,
    coverImage: "https://res.cloudinary.com/demo/image/upload/a.png",
    gallery: [],
    link: null,
    tags: [],
    date: null,
    slug: "harbour",
    order: 0,
};

const experienceRow = {
    id: "experience-1",
    kind: "work" as const,
    org: "Acme",
    role: "Engineer",
    location: null,
    startDate: "2021-01",
    endDate: null,
    isCurrent: true,
    description: null,
    order: 0,
};

describe("portfolio tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(listExperience).mockResolvedValue([experienceRow]);
        vi.mocked(listPortfolio).mockResolvedValue([
            { ...showcaseRow, items: [itemRow] },
        ]);
        vi.mocked(listShowcases).mockResolvedValue([showcaseRow]);
        vi.mocked(createShowcase).mockResolvedValue({
            id: "showcase-2",
            slug: "work-abc",
        });
        vi.mocked(createItem).mockResolvedValue({
            id: "item-2",
            slug: "harbour-abc",
        });
    });

    it("lists the showcases with their items and the experience list", async () => {
        const result = await handleListPortfolio({}, context);

        expect(listPortfolio).toHaveBeenCalledWith({ userId: "alice" });
        expect(listExperience).toHaveBeenCalledWith({ userId: "alice" });
        expect(
            JSON.parse(result.content[0].text).data.showcases[0].items[0].id,
        ).toBe("item-1");
        expect(
            JSON.parse(result.content[0].text).data.experience[0].id,
        ).toBe("experience-1");
    });

    it("creates a showcase", async () => {
        const result = await handleCreateShowcase(
            { title: "Work", description: null, layout: "grid" },
            context,
        );

        expect(createShowcase).toHaveBeenCalledWith(
            { userId: "alice" },
            { title: "Work", description: null, layout: "grid" },
        );
        expect(JSON.parse(result.content[0].text).data.id).toBe("showcase-2");
    });

    it("merges a partial showcase over the stored one", async () => {
        await handleUpdateShowcase(
            { showcaseId: "showcase-1", title: "Shipped" },
            context,
        );

        expect(updateShowcase).toHaveBeenCalledWith(
            { userId: "alice" },
            {
                showcaseId: "showcase-1",
                title: "Shipped",
                description: null,
                layout: "grid",
            },
        );
    });

    it("refuses a showcase that is not the caller's", async () => {
        vi.mocked(listShowcases).mockResolvedValue([]);

        const result = await handleUpdateShowcase(
            { showcaseId: "other", title: "Shipped" },
            context,
        );

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe("Showcase not found");
    });

    it("moves a showcase up", async () => {
        await handleMoveShowcase(
            { showcaseId: "showcase-1", direction: "up" },
            context,
        );

        expect(moveShowcase).toHaveBeenCalledWith(
            { userId: "alice" },
            { showcaseId: "showcase-1", direction: -1 },
        );
    });

    it("deletes a showcase", async () => {
        await handleDeleteShowcase({ showcaseId: "showcase-1" }, context);

        expect(deleteShowcase).toHaveBeenCalledWith(
            { userId: "alice" },
            { showcaseId: "showcase-1" },
        );
    });

    it("creates a project in a showcase", async () => {
        await handleCreateItem(
            { showcaseId: "showcase-1", title: "Harbour" },
            context,
        );

        expect(createItem).toHaveBeenCalledWith(
            { userId: "alice" },
            {
                showcaseId: "showcase-1",
                title: "Harbour",
                summary: null,
                description: null,
                coverImage: null,
                gallery: [],
                link: null,
                tags: [],
                date: null,
            },
        );
    });

    it("merges a partial project over the stored one", async () => {
        await handleUpdateItem(
            { itemId: "item-1", title: "Harbour lights" },
            context,
        );

        expect(updateItem).toHaveBeenCalledWith(
            { userId: "alice" },
            expect.objectContaining({
                itemId: "item-1",
                title: "Harbour lights",
                summary: "A harbour at dusk",
            }),
        );
    });

    it("clears a field the caller sends as null", async () => {
        await handleUpdateItem({ itemId: "item-1", coverImage: null }, context);

        expect(updateItem).toHaveBeenCalledWith(
            { userId: "alice" },
            expect.objectContaining({
                itemId: "item-1",
                coverImage: null,
                summary: "A harbour at dusk",
            }),
        );
    });

    it("refuses a project that is not the caller's", async () => {
        vi.mocked(listPortfolio).mockResolvedValue([]);

        const result = await handleUpdateItem(
            { itemId: "other", title: "Harbour lights" },
            context,
        );

        expect(result.content[0].text).toBe("Item not found");
    });

    it("moves a project down", async () => {
        await handleMoveItem({ itemId: "item-1", direction: "down" }, context);

        expect(moveItem).toHaveBeenCalledWith(
            { userId: "alice" },
            { itemId: "item-1", direction: 1 },
        );
    });

    it("deletes a project", async () => {
        await handleDeleteItem({ itemId: "item-1" }, context);

        expect(deleteItem).toHaveBeenCalledWith(
            { userId: "alice" },
            { itemId: "item-1" },
        );
    });

    it("surfaces the refusal of a cover image that is not a stored asset", async () => {
        vi.mocked(createItem).mockRejectedValue(
            new Error(
                "Invalid portfolio input: coverImage must be a Cloudinary URL or a /covers/ path",
            ),
        );

        const result = await handleCreateItem(
            {
                showcaseId: "showcase-1",
                title: "Harbour",
                coverImage: "javascript:alert(1)",
            },
            context,
        );

        expect(result.content[0].text).toContain("Invalid portfolio input");
        expect(result.isError).toBe(true);
    });
});
