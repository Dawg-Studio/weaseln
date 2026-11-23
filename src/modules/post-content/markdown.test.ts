import { describe, expect, it } from "vitest";

import {
    findUnsupportedNodes,
    markdownToTiptap,
    tiptapToMarkdown,
} from "./markdown";

const document = [
    "# Title",
    "",
    "A paragraph with **bold**, *italic*, `code` and a [link](https://example.com).",
    "",
    "- one",
    "- two",
    "",
    "1. first",
    "2. second",
    "",
    "- [ ] todo",
    "- [x] done",
    "",
    "> quoted",
    "",
    "```",
    "const x = 1;",
    "```",
    "",
    "---",
    "",
    "![alt text](https://res.cloudinary.com/demo/image/upload/x.png)",
].join("\n");

describe("markdown converter", () => {
    it("converts headings, paragraphs and emphasis", () => {
        const doc = markdownToTiptap("# Title\n\nHello **world**");

        expect(doc.type).toBe("doc");
        expect(doc.content?.[0]).toEqual({
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Title" }],
        });
        expect(doc.content?.[1].type).toBe("paragraph");
        const marks = doc.content?.[1].content?.[1].marks;
        expect(marks).toEqual([{ type: "bold" }]);
    });

    it("converts bullet, ordered and task lists", () => {
        const doc = markdownToTiptap("- a\n\n1. b\n\n- [ ] c\n- [x] d");

        expect(doc.content?.[0].type).toBe("bulletList");
        expect(doc.content?.[0].content?.[0].type).toBe("listItem");
        expect(doc.content?.[1].type).toBe("orderedList");
        expect(doc.content?.[1].content?.[0].type).toBe("listItem");
        expect(doc.content?.[2].type).toBe("taskList");
        expect(doc.content?.[2].content?.[0]).toEqual(
            expect.objectContaining({
                type: "taskItem",
                attrs: { checked: false },
            }),
        );
        expect(doc.content?.[2].content?.[1]).toEqual(
            expect.objectContaining({
                type: "taskItem",
                attrs: { checked: true },
            }),
        );
    });

    it("converts code blocks, blockquotes and rules", () => {
        const doc = markdownToTiptap(
            "```\nconst x = 1;\n```\n\n> quoted\n\n---",
        );

        expect(doc.content?.[0].type).toBe("codeBlock");
        expect(doc.content?.[0].content?.[0]).toEqual({
            type: "text",
            text: "const x = 1;",
        });
        expect(doc.content?.[1].type).toBe("blockquote");
        expect(doc.content?.[2].type).toBe("horizontalRule");
    });

    it("converts images and links", () => {
        const doc = markdownToTiptap(
            "![alt text](https://example.com/x.png)\n\n[label](https://example.com)",
        );

        expect(doc.content?.[0]).toEqual({
            type: "image",
            attrs: { src: "https://example.com/x.png", alt: "alt text" },
        });
        expect(doc.content?.[1].content?.[0].marks).toEqual([
            { type: "link", attrs: { href: "https://example.com" } },
        ]);
    });

    it("round trips a document without changing it", () => {
        expect(tiptapToMarkdown(markdownToTiptap(document))).toBe(document);
    });

    it("degrades an unknown construct to a paragraph", () => {
        const doc = markdownToTiptap("| a | b |\n| - | - |");

        expect(doc.content?.[0].type).toBe("paragraph");
        // A table is not markdown this converter speaks, so its lines stay
        // literal text rather than failing the write.
        expect(doc.content?.[0].content?.[0].text).toBe(
            "| a | b | | - | - |",
        );
    });

    it("names the nodes it cannot represent", () => {
        expect(
            findUnsupportedNodes({
                type: "doc",
                content: [
                    { type: "paragraph", content: [{ type: "text", text: "hi" }] },
                    { type: "youtube", attrs: { src: "https://youtu.be/x" } },
                ],
            }),
        ).toEqual(["youtube"]);

        expect(
            findUnsupportedNodes(markdownToTiptap(document)),
        ).toEqual([]);
    });
});
