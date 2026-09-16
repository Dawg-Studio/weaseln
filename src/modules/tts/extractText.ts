import type { JSONContent } from "@tiptap/react";
import { TTS_LIMITS, TTS_MIN_CHARS } from "./limits";
import type { TtsEligibility } from "./types";

/**
 * Walk a Tiptap JSONContent tree and collect plain text.
 * Handles paragraphs, headings, lists, blockquotes, code, etc. by concatenating
 * text nodes with lightweight separators.
 */
export function tiptapToPlainText(content: unknown): string {
    if (!content || typeof content !== "object") return "";
    const root = content as JSONContent;
    const parts: string[] = [];

    function walk(node: JSONContent) {
        if (node.type === "text" && typeof node.text === "string") {
            parts.push(node.text);
        }
        // Hard breaks should become spaces
        if (node.type === "hardBreak") parts.push("\n");
        if (Array.isArray(node.content)) {
            for (const child of node.content) walk(child as JSONContent);
            // Paragraph-like nodes get a double newline boundary
            if (
                node.type === "paragraph" ||
                node.type === "heading" ||
                node.type === "blockquote" ||
                node.type === "listItem"
            )
                parts.push("\n\n");
        }
    }

    if (Array.isArray(root.content)) {
        for (const n of root.content) walk(n as JSONContent);
    } else {
        walk(root);
    }

    // Normalize whitespace: collapse runs, trim, drop empty image/youtube nodes
    return parts
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();
}

/**
 * Build the synthesis text from a Post row.
 * Title + description + body plain text, in reading order.
 */
export function buildSynthesisText(args: {
    title?: string | null;
    description?: string | null;
    content?: unknown;
}): string {
    const segments: string[] = [];
    if (args.title?.trim()) segments.push(args.title.trim());
    if (args.description?.trim()) segments.push(args.description.trim());
    const body = tiptapToPlainText(args.content);
    if (body) segments.push(body);
    // Join with double newline — most TTS engines treat it as a pause.
    const joined = segments.join("\n\n").trim();
    // Strip HTML tags that may have leaked from fallback generateHTML paths
    return joined.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function checkEligibility(text: string): TtsEligibility {
    const len = text.length;
    if (!text || len < TTS_MIN_CHARS)
        return {
            eligible: false,
            reason: "Post has no readable text to synthesize.",
            code: "EMPTY_CONTENT",
            charCount: len,
        };
    if (len > TTS_LIMITS.maxChars)
        return {
            eligible: false,
            reason: `Text is too long (${len} chars). Maximum is ${TTS_LIMITS.maxChars} chars. Shorten the post or split it.`,
            code: "TOO_LONG",
            charCount: len,
        };
    return { eligible: true, charCount: len };
}
