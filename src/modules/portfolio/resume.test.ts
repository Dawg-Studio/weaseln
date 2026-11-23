import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    applyResumeProposal,
    assertResumeBytes,
    getResumeDownloadUrl,
    parseResumePdf,
    removeResume,
    ResumeError,
    uploadResume,
} from "./resume";
import { MAX_RESUME_BYTES } from "./types";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockExperienceCreateMany = vi.fn();
const mockExperienceFindMany = vi.fn();
const mockUpload = vi.fn();
const mockDestroy = vi.fn();
const mockDownloadUrl = vi.fn();

vi.mock("@/db", () => ({
    default: {
        user: {
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
        },
        userExperience: {
            createMany: (...args: unknown[]) => mockExperienceCreateMany(...args),
            findMany: (...args: unknown[]) => mockExperienceFindMany(...args),
        },
        // The interactive transaction form: the callback runs against a tx
        // that offers the same models.
        $transaction: async (fn: (_tx: unknown) => Promise<unknown>) =>
            fn({
                user: {
                    findUnique: (...args: unknown[]) => mockFindUnique(...args),
                    update: (...args: unknown[]) => mockUpdate(...args),
                },
                userExperience: {
                    createMany: (...args: unknown[]) =>
                        mockExperienceCreateMany(...args),
                    findMany: (...args: unknown[]) =>
                        mockExperienceFindMany(...args),
                },
            }),
    },
}));

vi.mock("@/lib/cloudinary", () => ({
    uploadCloudinary: (...args: unknown[]) => mockUpload(...args),
    destroyCloudinaryAsset: (...args: unknown[]) => mockDestroy(...args),
    getPrivateDownloadUrl: (...args: unknown[]) => mockDownloadUrl(...args),
}));

const actor = { userId: "alice" };
const unreadable = async () => "not json";

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

    it("reads a current role the parser marked in words as current", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    experience: [
                        {
                            kind: "work",
                            org: "Acme",
                            role: "Dev",
                            location: null,
                            startDate: "2021-01",
                            endDate: "Present",
                            isCurrent: "True",
                            description: null,
                        },
                    ],
                }),
        });
        expect(proposal.experience[0].isCurrent).toBe(true);
        expect(proposal.experience[0].endDate).toBeNull();
    });

    it("keeps a degree as education", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    experience: [
                        {
                            kind: "Education",
                            org: "TU Berlin",
                            role: "BSc",
                            location: null,
                            startDate: "2017",
                            endDate: "2021",
                            isCurrent: false,
                            description: null,
                        },
                    ],
                }),
        });
        expect(proposal.experience[0].kind).toBe("education");
    });

    it("reads a headline that is not a string as absent", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({ ...validProposal, headline: 2020 }),
        });
        expect(proposal.headline).toBeNull();
    });

    it("reads a skills list the parser answered as one skill", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({ ...validProposal, skills: "TypeScript" }),
        });
        expect(proposal.skills).toEqual(["TypeScript"]);
    });

    it("drops a link with an empty label", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    links: [
                        { label: "", url: "https://alice.dev" },
                        { label: "GitHub", url: "https://github.com/alice" },
                    ],
                }),
        });
        expect(proposal.links).toEqual([
            { label: "GitHub", url: "https://github.com/alice" },
        ]);
    });

    it("normalises a current role that came with an end date", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    experience: [
                        {
                            kind: "work",
                            org: "Acme",
                            role: "Dev",
                            location: null,
                            startDate: "2021-01",
                            endDate: "Present",
                            isCurrent: true,
                            description: null,
                        },
                    ],
                }),
        });
        expect(proposal.experience[0].endDate).toBeNull();
        expect(proposal.experience[0].isCurrent).toBe(true);
    });

    it("drops a link the parser got wrong instead of the whole proposal", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    links: [
                        { label: "Site", url: "alice.dev" },
                        { label: "GitHub", url: "https://github.com/alice" },
                    ],
                }),
        });
        expect(proposal.links).toEqual([
            { label: "GitHub", url: "https://github.com/alice" },
        ]);
    });

    it("drops a role the parser left empty", async () => {
        const proposal = await parseResumePdf(pdf(), {
            generate: async () =>
                JSON.stringify({
                    ...validProposal,
                    experience: [
                        { kind: "work", org: "", role: "Dev" },
                        {
                            kind: "work",
                            org: "Acme",
                            role: "Engineer",
                            location: null,
                            startDate: "2021-01",
                            endDate: null,
                            isCurrent: true,
                            description: null,
                        },
                    ],
                }),
        });
        expect(proposal.experience).toHaveLength(1);
        expect(proposal.experience[0].org).toBe("Acme");
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

describe("resume storage", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_CLOUDINARY_NAME", "leindfraust");
        mockFindUnique.mockReset();
        mockUpdate.mockReset();
        mockExperienceCreateMany.mockReset();
        mockUpload.mockReset();
        mockDestroy.mockReset();
        mockDownloadUrl.mockReset();

        mockFindUnique.mockResolvedValue({ resumePublicId: null, resumePublic: false, socials: [] });
        mockUpdate.mockResolvedValue({ id: "alice" });
        mockExperienceCreateMany.mockResolvedValue({ count: 0 });
        mockExperienceFindMany.mockResolvedValue([]);
        mockUpload.mockResolvedValue({
            upload: { ok: true },
            metadata: { timestamp: 1700000000, folder: "postdevfy/portfolio", public_id: "alice-1", resourceType: "raw", type: "private" },
        });
        mockDestroy.mockResolvedValue(true);
        mockDownloadUrl.mockReturnValue("https://api.cloudinary.com/v1_1/leindfraust/raw/download?signed");
    });

    it("keeps the stored file when parsing fails", async () => {
        const result = await uploadResume(actor, { bytes: pdf(), generate: unreadable });
        expect(result.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
        expect(result.proposal).toBeNull();
        expect(result.error).toMatch(/could not read/i);
    });

    it("stores the private public_id so the asset can be destroyed later", async () => {
        await uploadResume(actor, { bytes: pdf(), generate: unreadable });
        expect(mockUpdate.mock.calls[0][0].data).toMatchObject({ resumePublicId: "alice-1" });
    });

    it("destroys the previous asset when a resume is replaced", async () => {
        mockFindUnique.mockResolvedValue({ resumePublicId: "old", resumePublic: false, socials: [] });
        await uploadResume(actor, { bytes: pdf(), generate: unreadable });
        expect(mockDestroy).toHaveBeenCalledWith(expect.objectContaining({ public_id: "old" }));
    });

    it("removes the columns and destroys the asset", async () => {
        mockFindUnique.mockResolvedValue({ resumePublicId: "old", resumePublic: true, socials: [] });
        await removeResume(actor);
        expect(mockDestroy).toHaveBeenCalled();
        expect(mockUpdate.mock.calls[0][0].data).toEqual({
            resumeUrl: null,
            resumePublicId: null,
            resumePublic: false,
        });
    });

    it("gives a stranger no download URL when the resume is private", async () => {
        mockFindUnique.mockResolvedValue({ resumePublic: false, resumePublicId: "p", resumeUrl: "u" });
        expect(await getResumeDownloadUrl({ userId: "bob" }, { userId: "alice" })).toBeNull();
        expect(mockDownloadUrl).not.toHaveBeenCalled();
    });

    it("gives a stranger a signed URL when the owner published it", async () => {
        mockFindUnique.mockResolvedValue({ resumePublic: true, resumePublicId: "p", resumeUrl: "u" });
        expect(await getResumeDownloadUrl({ userId: "bob" }, { userId: "alice" })).toBe(
            "https://api.cloudinary.com/v1_1/leindfraust/raw/download?signed",
        );
    });

    it("applies only the facts it is given and leaves nulls alone", async () => {
        const result = await applyResumeProposal(actor, {
            headline: "Engineer",
            summary: null,
            location: null,
            links: [],
            skills: ["TS"],
            experience: [],
        });
        expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("bio");
        expect(mockUpdate.mock.calls[0][0].data).toMatchObject({ occupation: "Engineer", skills: ["TS"] });
        expect(result.experience).toBe(0);
    });

    it("merges resume links without dropping an existing social", async () => {
        mockFindUnique.mockResolvedValue({
            resumePublicId: null,
            resumePublic: false,
            socials: [{ name: "GitHub", url: "https://github.com/old" }],
        });
        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [{ label: "GitHub", url: "https://github.com/new" }, { label: "Site", url: "https://alice.dev" }],
            skills: [],
            experience: [],
        });
        const socials = mockUpdate.mock.calls[0][0].data.socials as { name: string; url: string }[];
        expect(socials.find((s) => s.name === "GitHub")?.url).toBe("https://github.com/old");
        expect(socials.find((s) => s.name === "Site")?.url).toBe("https://alice.dev");
    });

    it("inserts the confirmed experience rows and reports the count", async () => {
        const result = await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [],
            skills: [],
            experience: [
                { kind: "work", org: "Acme", role: "Engineer", location: null, startDate: "2021-01", endDate: null, isCurrent: true, description: null },
            ],
        });
        expect(mockExperienceCreateMany.mock.calls[0][0].data).toHaveLength(1);
        expect(result.experience).toBe(1);
    });

    it("refuses an unvalidated experience row", async () => {
        await expect(
            applyResumeProposal(actor, {
                headline: null,
                summary: null,
                location: null,
                links: [],
                skills: [],
                experience: [{ kind: "sidequest", org: "Acme", role: "Engineer" }],
            }),
        ).rejects.toThrow(/kind/);
    });
});

describe("resume removal and skills", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_CLOUDINARY_NAME", "leindfraust");
        mockFindUnique.mockReset();
        mockUpdate.mockReset();
        mockDestroy.mockReset();
        mockFindUnique.mockResolvedValue({ resumePublicId: "old", resumePublic: true, socials: [] });
        mockUpdate.mockResolvedValue({ id: "alice" });
        mockDestroy.mockResolvedValue(true);
    });

    it("does not claim a removal that the storage refused", async () => {
        mockDestroy.mockResolvedValue(false);
        await expect(removeResume(actor)).rejects.toThrow(/could not delete/i);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("puts applied rows after the ones already on the profile", async () => {
        mockExperienceFindMany.mockResolvedValueOnce([{ order: 2 }]);
        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [],
            skills: [],
            experience: [
                { kind: "work", org: "Acme", role: "Engineer", location: null, startDate: "2021-01", endDate: null, isCurrent: true, description: null },
                { kind: "work", org: "Beta", role: "Engineer", location: null, startDate: "2019-01", endDate: null, isCurrent: true, description: null },
            ],
        });
        const rows = mockExperienceCreateMany.mock.calls[0][0].data as { order: number }[];
        expect(rows.map((row) => row.order)).toEqual([3, 4]);
    });

    it("fills an empty social with the confirmed link", async () => {
        mockFindUnique.mockResolvedValue({
            resumePublicId: null,
            resumePublic: false,
            socials: [{ name: "Personal Website", url: "" }],
        });
        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [{ label: "Personal Website", url: "https://alice.dev" }],
            skills: [],
            experience: [],
        });
        const socials = mockUpdate.mock.calls[0][0].data.socials as {
            name: string;
            url: string;
        }[];
        expect(socials.find((s) => s.name === "Personal Website")?.url).toBe(
            "https://alice.dev",
        );
    });

    it("refuses a malformed experience payload instead of writing nothing", async () => {
        await expect(
            applyResumeProposal(actor, {
                headline: null,
                summary: null,
                location: null,
                links: [],
                skills: [],
                experience: "nope",
            }),
        ).rejects.toThrow(/experience/);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("re-reads the socials inside the transaction so a retry does not replay a stale merge", async () => {
        mockFindUnique
            .mockResolvedValueOnce({
                socials: [{ name: "Facebook", url: "https://old" }],
            })
            .mockResolvedValueOnce({
                socials: [{ name: "Twitter", url: "https://new" }],
            });
        mockUpdate.mockRejectedValueOnce(
            Object.assign(new Error("could not serialize access"), {
                code: "P2034",
            }),
        );

        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [{ label: "GitHub", url: "https://github.com/alice" }],
            skills: [],
            experience: [],
        });

        const written = mockUpdate.mock.calls.at(-1)![0].data.socials as {
            name: string;
        }[];
        expect(written.map((entry) => entry.name)).toContain("Twitter");
    });

    it("keeps a stored social it cannot read", async () => {
        mockFindUnique.mockResolvedValue({
            resumePublicId: null,
            resumePublic: false,
            socials: [null, { name: "Facebook", url: "https://fb" }],
        });

        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [{ label: "GitHub", url: "https://github.com/alice" }],
            skills: [],
            experience: [],
        });

        const written = mockUpdate.mock.calls[0][0].data.socials as {
            name?: string;
        }[];
        expect(written.some((entry) => entry?.name === "Facebook")).toBe(true);
        expect(written.some((entry) => entry === null)).toBe(false);
    });

    it("leaves curated skills alone when the resume found none", async () => {
        await applyResumeProposal(actor, {
            headline: null,
            summary: null,
            location: null,
            links: [],
            skills: [],
            experience: [],
        });
        expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("skills");
    });
});
