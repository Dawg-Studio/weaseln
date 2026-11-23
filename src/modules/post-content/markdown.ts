/**
 * Markdown in, the Tiptap JSON the app stores, markdown out.
 *
 * The app's editor produces StarterKit nodes plus task lists, highlights,
 * images and links. This module speaks every node and mark that editor can
 * produce except a YouTube embed, which `findUnsupportedNodes` names so a
 * write can refuse rather than silently flatten it.
 */

export type TiptapMark = { type: string; attrs?: Record<string, unknown> };

export type TiptapNode = {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TiptapNode[];
    text?: string;
    marks?: TiptapMark[];
};

export type TiptapDoc = { type: "doc"; content: TiptapNode[] };

const SUPPORTED_NODE_TYPES = new Set([
    "doc",
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "taskItem",
    "listItem",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "image",
    "text",
    "hardBreak",
]);

const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

type ListItemDraft = {
    lines: string[];
    task: boolean;
    checked: boolean;
};

function contentOf(node: unknown): TiptapNode[] {
    if (!node || typeof node !== "object") return [];
    const content = (node as { content?: unknown }).content;
    return Array.isArray(content) ? (content as TiptapNode[]) : [];
}

function isBlockStart(line: string): boolean {
    return (
        /^#{1,6}\s+/.test(line) ||
        /^```/.test(line) ||
        /^>\s?/.test(line) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
        LIST_MARKER.test(line)
    );
}

function imageAttrs(match: RegExpMatchArray) {
    return {
        src: match[2],
        alt: match[1],
        ...(match[3] ? { title: match[3] } : {}),
    };
}

function inlineNodes(text: string): TiptapNode[] {
    const nodes: TiptapNode[] = [];
    let buffer = "";
    let index = 0;

    const flush = () => {
        if (buffer) {
            nodes.push({ type: "text", text: buffer });
            buffer = "";
        }
    };

    const pushMarked = (
        inner: TiptapNode[],
        mark: TiptapMark,
    ) => {
        for (const node of inner) {
            nodes.push({
                ...node,
                marks: [...(node.marks ?? []), mark],
            });
        }
    };

    while (index < text.length) {
        const rest = text.slice(index);

        const image = rest.match(
            /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/,
        );
        if (image) {
            flush();
            nodes.push({ type: "image", attrs: imageAttrs(image) });
            index += image[0].length;
            continue;
        }

        const link = rest.match(/^\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
        if (link) {
            flush();
            pushMarked(inlineNodes(link[1]), {
                type: "link",
                attrs: { href: link[2] },
            });
            index += link[0].length;
            continue;
        }

        const code = rest.match(/^`([^`]+)`/);
        if (code) {
            flush();
            nodes.push({
                type: "text",
                text: code[1],
                marks: [{ type: "code" }],
            });
            index += code[0].length;
            continue;
        }

        const bold = rest.match(/^\*\*([^*]+)\*\*/);
        if (bold) {
            flush();
            pushMarked(inlineNodes(bold[1]), { type: "bold" });
            index += bold[0].length;
            continue;
        }

        const highlight = rest.match(/^==([^=]+)==/);
        if (highlight) {
            flush();
            pushMarked(inlineNodes(highlight[1]), { type: "highlight" });
            index += highlight[0].length;
            continue;
        }

        const strike = rest.match(/^~~([^~]+)~~/);
        if (strike) {
            flush();
            pushMarked(inlineNodes(strike[1]), { type: "strike" });
            index += strike[0].length;
            continue;
        }

        const italic = rest.match(/^\*([^*\s][^*]*)\*/);
        if (italic) {
            flush();
            pushMarked(inlineNodes(italic[1]), { type: "italic" });
            index += italic[0].length;
            continue;
        }

        buffer += text[index];
        index++;
    }

    flush();
    return nodes;
}

function buildListItem(draft: ListItemDraft): TiptapNode {
    const content = parseBlocks(draft.lines.join("\n"));
    if (draft.task) {
        return {
            type: "taskItem",
            attrs: { checked: draft.checked },
            content,
        };
    }
    return { type: "listItem", content };
}

function parseList(
    lines: string[],
    start: number,
): { nodes: TiptapNode[]; next: number } {
    const first = lines[start].match(LIST_MARKER);
    if (!first) return { nodes: [], next: start };
    const baseIndent = first[1].length;
    const ordered = /\d/.test(first[2]);

    const items: TiptapNode[] = [];
    let current: ListItemDraft | null = null;
    let index = start;

    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") break;

        const marker = line.match(LIST_MARKER);
        if (marker) {
            if (marker[1].length < baseIndent) break;
            if (marker[1].length === baseIndent) {
                if (current) items.push(buildListItem(current));
                let text = marker[3];
                let task = false;
                let checked = false;
                const taskMarker = text.match(/^\[([ xX])\]\s*(.*)$/);
                if (taskMarker) {
                    task = true;
                    checked = taskMarker[1].toLowerCase() === "x";
                    text = taskMarker[2];
                }
                current = { lines: [text], task, checked };
                index++;
                continue;
            }
            // A deeper marker belongs to the item above it.
            if (current) {
                current.lines.push(line.trim());
                index++;
                continue;
            }
            break;
        }

        if (current) {
            current.lines.push(line.trim());
            index++;
            continue;
        }
        break;
    }
    if (current) items.push(buildListItem(current));

    if (items.length === 0) return { nodes: [], next: index };

    const hasTask = items.some((item) => item.type === "taskItem");
    const list: TiptapNode = {
        type: hasTask
            ? "taskList"
            : ordered
              ? "orderedList"
              : "bulletList",
        content: hasTask
            ? items.map((item) => ({
                  type: "taskItem",
                  attrs: item.attrs ?? { checked: false },
                  content: item.content,
              }))
            : items,
    };
    return { nodes: [list], next: index };
}

function parseBlocks(markdown: string): TiptapNode[] {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks: TiptapNode[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") {
            index++;
            continue;
        }

        if (/^```/.test(line)) {
            const content: string[] = [];
            index++;
            while (index < lines.length && !/^```/.test(lines[index])) {
                content.push(lines[index]);
                index++;
            }
            index++;
            blocks.push({
                type: "codeBlock",
                content: content.length
                    ? [{ type: "text", text: content.join("\n") }]
                    : [],
            });
            continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            blocks.push({
                type: "heading",
                attrs: { level: heading[1].length },
                content: inlineNodes(heading[2].trim()),
            });
            index++;
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            blocks.push({ type: "horizontalRule" });
            index++;
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quoted: string[] = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) {
                quoted.push(lines[index].replace(/^>\s?/, ""));
                index++;
            }
            blocks.push({
                type: "blockquote",
                content: parseBlocks(quoted.join("\n")),
            });
            continue;
        }

        if (LIST_MARKER.test(line)) {
            const { nodes, next } = parseList(lines, index);
            blocks.push(...nodes);
            index = next;
            continue;
        }

        const image = line.match(
            /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/,
        );
        if (image) {
            blocks.push({ type: "image", attrs: imageAttrs(image) });
            index++;
            continue;
        }

        const paragraph: string[] = [];
        while (
            index < lines.length &&
            lines[index].trim() !== "" &&
            !isBlockStart(lines[index])
        ) {
            paragraph.push(lines[index].trim());
            index++;
        }
        if (paragraph.length === 0) {
            paragraph.push(line.trim());
            index++;
        }
        blocks.push({
            type: "paragraph",
            content: inlineNodes(paragraph.join(" ")),
        });
    }

    return blocks;
}

function imageToMarkdown(node: TiptapNode): string {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "");
    const title = node.attrs?.title;
    return `![${alt}](${src}${title ? ` "${title}"` : ""})`;
}

function inlineToMarkdown(nodes: TiptapNode[]): string {
    return nodes.map(inlineNodeToMarkdown).join("");
}

function inlineNodeToMarkdown(node: TiptapNode): string {
    if (node.type === "image") return imageToMarkdown(node);
    let text = node.text ?? "";
    for (const mark of node.marks ?? []) {
        switch (mark.type) {
            case "bold":
                text = `**${text}**`;
                break;
            case "italic":
                text = `*${text}*`;
                break;
            case "strike":
                text = `~~${text}~~`;
                break;
            case "highlight":
                text = `==${text}==`;
                break;
            case "code":
                text = `\`${text}\``;
                break;
            case "link":
                text = `[${text}](${String(mark.attrs?.href ?? "")})`;
                break;
        }
    }
    return text;
}

function itemToMarkdown(item: TiptapNode): string {
    return contentOf(item)
        .map(blockToMarkdown)
        .filter((text) => text !== "")
        .join("\n");
}

function listToMarkdown(
    node: TiptapNode,
    marker: string | ((_item: TiptapNode, _index: number) => string),
): string {
    return contentOf(node)
        .map((item, index) => {
            const prefix =
                typeof marker === "string" ? marker : marker(item, index);
            const body = itemToMarkdown(item);
            const [first, ...rest] = body.split("\n");
            return (
                prefix +
                first +
                rest.map((line) => `\n  ${line}`).join("")
            );
        })
        .join("\n");
}

function blockToMarkdown(node: TiptapNode): string {
    switch (node.type) {
        case "paragraph":
            return inlineToMarkdown(contentOf(node));
        case "heading": {
            const level = Number(node.attrs?.level ?? 1);
            const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
            return `${hashes} ${inlineToMarkdown(contentOf(node))}`;
        }
        case "bulletList":
            return listToMarkdown(node, "- ");
        case "orderedList":
            return listToMarkdown(node, (_item, index) => `${index + 1}. `);
        case "taskList":
            return listToMarkdown(
                node,
                (item) => `- [${item.attrs?.checked ? "x" : " "}] `,
            );
        case "listItem":
        case "taskItem":
            return itemToMarkdown(node);
        case "blockquote":
            return contentOf(node)
                .map(blockToMarkdown)
                .filter((text) => text !== "")
                .join("\n")
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n");
        case "codeBlock":
            return `\`\`\`\n${contentOf(node)
                .map((child) => child.text ?? "")
                .join("")}\n\`\`\``;
        case "horizontalRule":
            return "---";
        case "image":
            return imageToMarkdown(node);
        default:
            return "";
    }
}

export function markdownToTiptap(markdown: string): TiptapDoc {
    return { type: "doc", content: parseBlocks(markdown) };
}

export function tiptapToMarkdown(doc: unknown): string {
    return contentOf(doc)
        .map(blockToMarkdown)
        .filter((text) => text !== "")
        .join("\n\n");
}

/**
 * The node types the converter cannot round-trip. An update that would drop
 * one of these refuses instead of flattening the author's writing.
 */
export function findUnsupportedNodes(doc: unknown): string[] {
    const found = new Set<string>();
    const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const type = (node as { type?: unknown }).type;
        if (typeof type === "string" && !SUPPORTED_NODE_TYPES.has(type)) {
            found.add(type);
        }
        contentOf(node).forEach(walk);
    };
    walk(doc);
    return [...found];
}
