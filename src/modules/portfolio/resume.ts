import { GoogleGenAI } from "@google/genai";

import { MAX_RESUME_BYTES, type ResumeProposal } from "./types";
import { validateResumeProposal } from "./validation";

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
