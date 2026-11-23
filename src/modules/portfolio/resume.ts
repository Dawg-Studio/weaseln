import { GoogleGenAI } from "@google/genai";

import prisma from "@/db";
import {
    destroyCloudinaryAsset,
    getPrivateDownloadUrl,
    uploadCloudinary,
} from "@/lib/cloudinary";
import type { Prisma } from "@/generated/prisma/client";
import type { PortfolioActor } from "@/modules/portfolio/service";
import { MAX_RESUME_BYTES, type ResumeLink, type ResumeProposal } from "./types";
import {
    validateExperienceInput,
    validateResumeFacts,
    validateResumeProposal,
} from "./validation";

/**
 * The status travels with the error so the route keeps its own 415, 422 and
 * 413 responses without matching on message text.
 */
export class ResumeError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ResumeError";
        this.status = status;
    }
}

// "%PDF-": a multipart part's Content-Type is whatever the client claims.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function assertResumeBytes(
    bytes: Uint8Array,
    claimedType?: string,
): void {
    if (claimedType && claimedType !== "application/pdf") {
        throw new ResumeError("Resume must be a PDF", 415);
    }
    if (bytes.length > MAX_RESUME_BYTES) {
        throw new ResumeError("Resume must be 5 MiB or smaller", 413);
    }
    const looksLikePdf = PDF_MAGIC.every((byte, index) => bytes[index] === byte);
    if (!looksLikePdf) {
        throw new ResumeError("File contents are not a PDF", 415);
    }
}

export type ResumeGenerate = (_bytes: Uint8Array) => Promise<string>;

const RESUME_PROMPT = [
    "Extract a resume into JSON.",
    "Use only what the document states. Never invent an employer, a date, a school or a skill.",
    "A field the document does not state is null; an empty list is [].",
    "startDate and endDate are YYYY or YYYY-MM. isCurrent is true when the document says Present or Current.",
    "description is the role's bullet points as markdown list items, or null.",
    "kind is work for employment and education for a degree or course.",
].join(" ");

const nullableString = { type: "string", nullable: true } as const;

const RESUME_SCHEMA = {
    type: "object",
    properties: {
        headline: nullableString,
        summary: nullableString,
        location: nullableString,
        links: {
            type: "array",
            items: {
                type: "object",
                properties: { label: { type: "string" }, url: { type: "string" } },
                required: ["label", "url"],
            },
        },
        skills: { type: "array", items: { type: "string" } },
        experience: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    kind: { type: "string", enum: ["work", "education"] },
                    org: { type: "string" },
                    role: { type: "string" },
                    location: nullableString,
                    startDate: nullableString,
                    endDate: nullableString,
                    isCurrent: { type: "boolean" },
                    description: nullableString,
                },
                required: ["kind", "org", "role", "isCurrent"],
            },
        },
    },
    required: ["links", "skills", "experience"],
} as const;

async function generateWithGemini(bytes: Uint8Array): Promise<string> {
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_AI_KEY as string,
    });
    const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
        contents: [
            {
                inlineData: {
                    data: Buffer.from(bytes).toString("base64"),
                    mimeType: "application/pdf",
                },
            },
            RESUME_PROMPT,
        ],
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: RESUME_SCHEMA,
        },
    });
    return response.text ?? "";
}

/**
 * A model response is untrusted text: a shape we do not recognize is an error,
 * never a partially mapped proposal.
 */
export async function parseResumePdf(
    bytes: Uint8Array,
    options?: { generate?: ResumeGenerate },
): Promise<ResumeProposal> {
    const generate = options?.generate ?? generateWithGemini;
    const text = await generate(bytes);

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new ResumeError("Could not read this resume", 422);
    }

    try {
        return validateResumeProposal(parsed);
    } catch (err) {
        const detail = err instanceof Error ? err.message : "unknown shape";
        throw new ResumeError(`Could not read this resume: ${detail}`, 422);
    }
}

const RESUME_FOLDER = "postdevfy/portfolio";
const RESUME_UPLOAD_FOLDER = "portfolio";
const RESUME_FORMAT = "pdf";

type ResumeUploadResult = {
    url: string;
    proposal: ResumeProposal | null;
    error: string | null;
};

function resumeDeliveryUrl(metadata: {
    timestamp: number;
    folder: string;
    public_id: string;
}): string {
    const cloud = process.env.NEXT_CLOUDINARY_NAME;
    return `https://res.cloudinary.com/${cloud}/raw/private/v${metadata.timestamp}/${metadata.folder}/${metadata.public_id}.pdf`;
}

/**
 * The file is written before it is parsed, so a parse failure still leaves the
 * owner with the PDF they uploaded. A replacement destroys the previous asset,
 * which is why a retry after a failed parse cannot leave orphans.
 */
export async function uploadResume(
    actor: PortfolioActor,
    options: { bytes: Uint8Array; generate?: ResumeGenerate },
): Promise<ResumeUploadResult> {
    assertResumeBytes(options.bytes);

    const previous = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { resumePublicId: true },
    });

    const cloudinary = await uploadCloudinary({
        file: new File([options.bytes], "resume.pdf", {
            type: "application/pdf",
        }),
        folder: RESUME_UPLOAD_FOLDER,
        public_id: `${actor.userId}-${Date.now()}`,
        resourceType: "raw",
        type: "private",
    });
    if (!cloudinary.upload.ok) {
        throw new ResumeError("Upload failed", 502);
    }

    const url = resumeDeliveryUrl(cloudinary.metadata);

    await prisma.user.update({
        where: { id: actor.userId },
        data: {
            resumeUrl: url,
            resumePublicId: cloudinary.metadata.public_id,
        },
    });

    if (previous?.resumePublicId) {
        await destroyCloudinaryAsset({
            public_id: previous.resumePublicId,
            folder: RESUME_FOLDER,
        });
    }

    try {
        const proposal = await parseResumePdf(options.bytes, {
            generate: options.generate,
        });
        return { url, proposal, error: null };
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Could not read this resume";
        return { url, proposal: null, error: message };
    }
}

export async function setResumeVisibility(
    actor: PortfolioActor,
    options: { isPublic: boolean },
): Promise<void> {
    await prisma.user.update({
        where: { id: actor.userId },
        data: { resumePublic: options.isPublic },
    });
}

// The asset is destroyed before the columns are cleared: a failed destroy
// throws while the owner still sees their resume, instead of a resume that
// looks gone but is still reachable by URL with no id left to delete it.
export async function removeResume(actor: PortfolioActor): Promise<void> {
    const row = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { resumePublicId: true },
    });

    if (row?.resumePublicId) {
        const destroyed = await destroyCloudinaryAsset({
            public_id: row.resumePublicId,
            folder: RESUME_FOLDER,
        });
        // Clearing the columns anyway would throw away the only handle that
        // could retry the delete, and the caller would report a removal that
        // did not happen.
        if (!destroyed) {
            throw new ResumeError("Could not delete the stored file", 502);
        }
    }

    await prisma.user.update({
        where: { id: actor.userId },
        data: {
            resumeUrl: null,
            resumePublicId: null,
            resumePublic: false,
        },
    });
}

export async function getResumeDownloadUrl(
    actor: PortfolioActor | null,
    options: { userId: string },
): Promise<string | null> {
    const row = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { resumePublic: true, resumePublicId: true },
    });
    if (!row?.resumePublicId) return null;

    const isOwner = actor?.userId === options.userId;
    if (!row.resumePublic && !isOwner) return null;

    return getPrivateDownloadUrl({
        public_id: row.resumePublicId,
        folder: RESUME_FOLDER,
        format: RESUME_FORMAT,
        expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
}

type StoredSocial = { name?: string; url?: string };

function mergeSocials(existing: unknown, links: ResumeLink[]): StoredSocial[] {
    const merged: StoredSocial[] = Array.isArray(existing)
        ? [...(existing as StoredSocial[])]
        : [];
    for (const link of links) {
        const index = merged.findIndex((entry) => entry.name === link.label);
        if (index === -1) {
            merged.push({ name: link.label, url: link.url });
            continue;
        }
        // The profile form always writes its three social fields, leaving an
        // empty URL for the ones the owner never filled in. A confirmed link
        // fills that gap; a real value is never overwritten.
        const current = merged[index];
        if (!current.url) {
            merged[index] = { ...current, url: link.url };
        }
    }
    return merged;
}

/**
 * Writes only what the owner confirmed. A null field leaves the stored value
 * alone: a resume that omits a summary must not blank the profile it merges
 * into.
 */
export async function applyResumeProposal(
    actor: PortfolioActor,
    input: unknown,
): Promise<{ experience: number }> {
    if (input === null || typeof input !== "object") {
        throw new Error("Invalid portfolio input: resume facts must be an object");
    }

    const { experience, ...factInput } = input as Record<string, unknown>;
    const facts = validateResumeFacts(factInput);
    // A proposal always carries an experience array. A payload without one is
    // malformed, and answering it as "added nothing" would report a silent
    // no-op as a success.
    if (!Array.isArray(experience)) {
        throw new Error(
            "Invalid portfolio input: experience must be an array",
        );
    }
    const entries = experience.map(validateExperienceInput);

    const current = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { socials: true },
    });

    const data: Prisma.UserUpdateInput = {
        socials: mergeSocials(current?.socials, facts.links) as Prisma.InputJsonValue[],
    };
    // An empty array from the parser means "the resume did not list skills",
    // not "delete the ones you typed" — same rule as a null field.
    if (facts.skills.length > 0) data.skills = facts.skills;
    if (facts.headline !== null) data.occupation = facts.headline;
    if (facts.summary !== null) data.bio = facts.summary;
    if (facts.location !== null) data.address = facts.location;

    await prisma.user.update({ where: { id: actor.userId }, data });

    if (entries.length > 0) {
        // The applied rows go after the ones already on the profile. Starting
        // at zero would give them the same order values as existing rows, and
        // moving a row then swaps two equal values, which looks like nothing
        // happened once the page reloads.
        const last = await prisma.userExperience.findMany({
            where: { userId: actor.userId },
            orderBy: { order: "desc" },
            take: 1,
            select: { order: true },
        });
        const baseOrder = (last[0]?.order ?? -1) + 1;

        await prisma.userExperience.createMany({
            data: entries.map((entry, index) => ({
                ...entry,
                userId: actor.userId,
                order: baseOrder + index,
            })),
        });
    }

    return { experience: entries.length };
}
