import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ponytail: Prisma 7 stripped the static `Prisma.dmmf` namespace — `_runtimeDataModel`
// only exposes { name, kind, type } per field and no `uniqueIndexes` / `foreignKeys`.
// Unsupported("tsvector") is also filtered out. We parse the schema.prisma file directly.
const SCHEMA = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

function extractModel(schema: string, modelName: string): string {
    const re = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
    const m = schema.match(re);
    if (!m) throw new Error(`model ${modelName} not found in schema.prisma`);
    return m[1];
}

function getFieldLine(body: string, fieldName: string): string {
    const re = new RegExp(`^\\s*${fieldName}\\s+[^\\n]+$`, "m");
    const m = body.match(re);
    if (!m) throw new Error(`field ${fieldName} not found`);
    return m[0];
}

describe("Prisma schema shape", () => {
    it("declares the Unsupported search_doc column on Post", () => {
        expect(
            /\bsearch_doc\b[^\n]*Unsupported\(\s*["']tsvector["']\s*\)/.test(SCHEMA),
            'prisma/schema.prisma must declare `search_doc Unsupported("tsvector")?` on Post',
        ).toBe(true);
    });

    it("EmailVerificationCode.key is unique", () => {
        const body = extractModel(SCHEMA, "EmailVerificationCode");
        const line = getFieldLine(body, "key");
        expect(line, "EmailVerificationCode.key must have @unique").toMatch(/@unique\b/);
    });

    it("User has no @@unique([id, ...]) constraints", () => {
        const body = extractModel(SCHEMA, "User");
        const compositeIdUniques = [...body.matchAll(/@@unique\(\s*\[([^\]]+)\]/g)]
            .map((m) => m[1].split(",").map((s) => s.trim()))
            .filter((fields) => fields.length > 1 && fields.some((f) => f.startsWith("id")));
        expect(compositeIdUniques, `unexpected composite id uniques: ${JSON.stringify(compositeIdUniques)}`).toEqual([]);
    });

    it("Post has only single-column userId FK (no author in FK list)", () => {
        const body = extractModel(SCHEMA, "Post");
        const userRel = getFieldLine(body, "user");
        expect(userRel).toMatch(/fields:\s*\[\s*userId\s*\]/);
        expect(userRel).toMatch(/references:\s*\[\s*id\s*\]/);
        expect(userRel).not.toMatch(/fields:\s*\[[^\]]*author/);
    });

    it("PostComment / CommentReaction / PostReaction have only userId FK", () => {
        for (const modelName of ["PostComment", "CommentReaction", "PostReaction"]) {
            const body = extractModel(SCHEMA, modelName);
            const userRel = getFieldLine(body, "user");
            expect(userRel, `${modelName} userId FK must be single-column`).toMatch(/fields:\s*\[\s*userId\s*\]/);
            expect(userRel).not.toMatch(/fields:\s*\[[^\]]*userName/);
            expect(userRel).not.toMatch(/fields:\s*\[[^\]]*userImage/);
        }
    });
});