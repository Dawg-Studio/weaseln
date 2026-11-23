import { GoogleGenAI } from "@google/genai";

import prisma from "@/db";
import {
    destroyCloudinaryAsset,
    getPrivateDownloadUrl,
    uploadCloudinary,
} from "@/lib/cloudinary";
import type { Prisma } from "@/generated/prisma/client";
import type { PortfolioActor } from "@/modules/portfolio/service";
import { serializable } from "@/utils/serializable";
import { MAX_RESUME_BYTES, type ResumeLink, type ResumeProposal } from "./types";
import {
    DATE_PATTERN,
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

const HTTP_URL = /^https?:\/\/\S+$/;
const PRESENT_WORDS = new Set(["present", "current", "now", "ongoing"]);

/**
 * The model's answer is a draft, not a submission. A field it got wrong is
 * normalised or dropped so one bad row does not cost the owner the whole
 * proposal - the checklist they review would be empty otherwise.
 */
function normaliseProposal(input: unknown): unknown {
    if (input === null || typeof input !== "object") return input;
    const proposal = { ...(input as Record<string, unknown>) };

    // The top-level fields are optional; a model that answered one with the
    // wrong type loses it rather than the whole proposal.
    for (const field of ["headline", "summary", "location"] as const) {
        if (typeof proposal[field] !== "string") proposal[field] = null;
    }
    if (!Array.isArray(proposal.links)) proposal.links = [];
    if (!Array.isArray(proposal.skills)) {
        proposal.skills =
            typeof proposal.skills === "string" ? [proposal.skills] : [];
    }
    // A proposal without an experience list has no entries; that is not a
    // reason to lose the headline, skills and links the parser did read.
    if (proposal.experience === null || proposal.experience === undefined) {
        proposal.experience = [];
    }

    if (Array.isArray(proposal.links)) {
        proposal.links = proposal.links.filter((link) => {
            if (!link || typeof link !== "object") return false;
            const entry = link as { label?: unknown; url?: unknown };
            return (
                typeof entry.label === "string" &&
                entry.label.trim().length > 0 &&
                typeof entry.url === "string" &&
                HTTP_URL.test(entry.url)
            );
        });
    }

    if (Array.isArray(proposal.skills)) {
        proposal.skills = proposal.skills
            .filter(
                (skill) => typeof skill === "string" && skill.trim().length > 0,
            )
            .map((skill) => (skill as string).trim());
    }

    if (Array.isArray(proposal.experience)) {
        proposal.experience = proposal.experience
            .filter((entry) => Boolean(entry) && typeof entry === "object")
            .map((entry) => {
                const row = { ...(entry as Record<string, unknown>) };
                if (typeof row.isCurrent === "string") {
                    row.isCurrent = row.isCurrent.trim().toLowerCase() === "true";
                }
                // A current role has no end date, and the model often answers
                // "Present" for one.
                if (row.isCurrent === true) {
                    row.endDate = null;
                } else if (
                    typeof row.endDate === "string" &&
                    PRESENT_WORDS.has(row.endDate.trim().toLowerCase())
                ) {
                    // The resume said the role runs to now, so it is current
                    // even when the model left the flag off.
                    row.endDate = null;
                    row.isCurrent = true;
                }
                if (
                    typeof row.kind !== "string" ||
                    row.kind.toLowerCase() !== "education"
                ) {
                    row.kind = "work";
                } else {
                    row.kind = "education";
                }
                for (const field of ["startDate", "endDate"] as const) {
                    if (
                        typeof row[field] !== "string" ||
                        !DATE_PATTERN.test(row[field] as string)
                    ) {
                        row[field] = null;
                    }
                }
                for (const field of ["location", "description"] as const) {
                    if (typeof row[field] !== "string") row[field] = null;
                }
                return row;
            })
            .filter((row) => {
                const org = (row as { org?: unknown }).org;
                const role = (row as { role?: unknown }).role;
                return (
                    typeof org === "string" &&
                    org.trim().length > 0 &&
                    typeof role === "string" &&
                    role.trim().length > 0
                );
            });
    }

    return proposal;
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
        return validateResumeProposal(normaliseProposal(parsed));
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

export type ResumeState = {
    hasResume: boolean;
    isPublic: boolean;
    downloadUrl: string | null;
};

/**
 * The owner's own view of the resume: the link is the owner's, so it is
 * given whether the resume is public or not. The visibility rule belongs to
 * `getResumeDownloadUrl`, which serves a visitor.
 */
export async function getResumeState(
    actor: PortfolioActor,
): Promise<ResumeState> {
    const row = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { resumePublic: true, resumePublicId: true },
    });
    if (!row?.resumePublicId) {
        return { hasResume: false, isPublic: false, downloadUrl: null };
    }
    return {
        hasResume: true,
        isPublic: row.resumePublic,
        downloadUrl: await getPrivateDownloadUrl({
            public_id: row.resumePublicId,
            folder: RESUME_FOLDER,
            format: RESUME_FORMAT,
            expiresAt: Math.floor(Date.now() / 1000) + 60,
        }),
    };
}

/**
 * What identifies an experience row: the same role at the same organization
 * starting the same month is one entry, however many times a resume lists it.
 * JSON rather than a delimiter, so a role with a separator in it cannot
 * collide with another pair.
 */
function experienceKey(entry: {
    kind: string;
    org: string;
    role: string;
    startDate: string | null;
}): string {
    return JSON.stringify([
        entry.kind,
        entry.org,
        entry.role,
        entry.startDate,
    ]);
}

type StoredSocial = { name?: string; url?: string };

function mergeSocials(existing: unknown, links: ResumeLink[]): StoredSocial[] {
    // A stored entry that is not renderable is dropped: a row written before
    // the request was validated can hold a non-string url, and the profile
    // calls `.includes` on it.
    const merged: StoredSocial[] = (
        Array.isArray(existing) ? existing : []
    ).filter((entry): entry is StoredSocial => {
        if (!entry || typeof entry !== "object") return false;
        const url = (entry as { url?: unknown }).url;
        return url === undefined || url === null || typeof url === "string";
    });
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

    const data: Prisma.UserUpdateInput = {};
    // An empty array from the parser means "the resume did not list skills",
    // not "delete the ones you typed" — same rule as a null field.
    if (facts.skills.length > 0) data.skills = facts.skills;
    if (facts.headline !== null) data.occupation = facts.headline;
    if (facts.summary !== null) data.bio = facts.summary;
    if (facts.location !== null) data.address = facts.location;

    // The merge reads the column and writes it back, so both happen inside
    // the transaction: a retry re-reads instead of replaying a stale merge,
    // and a profile save landing at the same moment cannot lose a link.
    let created = 0;
    await serializable(async (tx) => {
        const current = await tx.user.findUnique({
            where: { id: actor.userId },
            select: { socials: true },
        });
        data.socials = mergeSocials(
            current?.socials,
            facts.links,
        ) as Prisma.InputJsonValue[];

        await tx.user.update({ where: { id: actor.userId }, data });

        if (entries.length > 0) {
            // A retried apply must not append the profile's history twice, so
            // a row the profile already holds is skipped. The same read gives
            // the highest order, so one query answers both questions.
            const existing = await tx.userExperience.findMany({
                where: { userId: actor.userId },
                select: {
                    order: true,
                    kind: true,
                    org: true,
                    role: true,
                    startDate: true,
                },
            });
            const seen = new Set(existing.map(experienceKey));
            const fresh = entries.filter((entry) => {
                const key = experienceKey(entry);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            created = fresh.length;

            if (fresh.length > 0) {
                // The applied rows go after the ones already on the profile.
                // Starting at zero would give them the same order values as
                // existing rows, and moving a row then swaps two equal values,
                // which looks like nothing happened once the page reloads.
                const baseOrder =
                    existing.reduce(
                        (highest, row) => Math.max(highest, row.order),
                        -1,
                    ) + 1;

                await tx.userExperience.createMany({
                    data: fresh.map((entry, index) => ({
                        ...entry,
                        userId: actor.userId,
                        order: baseOrder + index,
                    })),
                });
            }
        }
    });

    return { experience: created };
}
