import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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
    it("does not declare search_doc on Post (apply-perf-migration.ts owns it)", () => {
        expect(
            /\bsearch_doc\b/.test(SCHEMA),
            "prisma/schema.prisma must NOT declare search_doc — the apply script owns it; Prisma client uses $queryRaw for FTS",
        ).toBe(false);
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

    it("portfolio models exist and have no denormalized owner on items", () => {
        const item = extractModel(SCHEMA, "PortfolioItem");
        expect(item).not.toMatch(/^\s*userId\s/m);
        expect(getFieldLine(extractModel(SCHEMA, "PortfolioShowcase"), "layout")).toMatch(
            /@default\("grid"\)/,
        );
        for (const name of ["PortfolioShowcase", "PortfolioItem", "UserExperience"]) {
            expect(extractModel(SCHEMA, name)).toMatch(/@@schema\("users"\)/);
        }
    });

    it("User carries the resume columns and resumePublic defaults to off", () => {
        const user = extractModel(SCHEMA, "User");
        expect(getFieldLine(user, "resumePublic")).toMatch(/@default\(false\)/);
        expect(getFieldLine(user, "resumePublicId")).toMatch(/String\?/);
    });
});

// ponytail: `prisma db push` may not run against this database (it wants to drop
// the legacy blogs."Blog" table), so every model and column the schema declares
// has to exist in SQL the build applies. These are the guard for the outage
// where the portfolio models landed in the schema with no migration to apply
// them and the profile page died on a missing users."User".skills column.
const MIGRATIONS_DIR = resolve(process.cwd(), "prisma/migrations");
const MIGRATION_FOLDERS = readdirSync(MIGRATIONS_DIR).filter((folder) =>
    existsSync(resolve(MIGRATIONS_DIR, folder, "migration.sql")),
);
const SQL_CORPUS = MIGRATION_FOLDERS.map((folder) =>
    readFileSync(resolve(MIGRATIONS_DIR, folder, "migration.sql"), "utf8"),
).join("\n");
const APPLY_SCRIPT = readFileSync(resolve(process.cwd(), "scripts/apply-perf-migration.ts"), "utf8");
const APPLIED_FOLDERS = [
    ...APPLY_SCRIPT.matchAll(/"prisma\/migrations\/([^"]+)\/migration\.sql"/g),
].map((m) => m[1]);

function parseModels(schema: string): Map<string, { name: string; type: string }[]> {
    const models = new Map<string, { name: string; type: string }[]>();
    for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
        const fields = match[2]
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
            .map((line) => line.split(/\s+/))
            .filter((parts) => parts.length > 1)
            .map((parts) => ({ name: parts[0], type: parts[1] }));
        models.set(match[1], fields);
    }
    return models;
}

const MODELS = parseModels(SCHEMA);

describe("schema vs applied SQL", () => {
    it("creates every model the schema declares in some migration", () => {
        for (const model of MODELS.keys()) {
            expect(
                new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"[^"]*"\\."${model}"`).test(SQL_CORPUS),
                `model ${model} has no CREATE TABLE in prisma/migrations — prisma db push cannot run here, so the SQL must exist`,
            ).toBe(true);
        }
    });

    it("names every scalar column of every model in some migration", () => {
        for (const [model, fields] of MODELS) {
            for (const field of fields) {
                // a relation field has no column of its own
                const target = field.type.replace(/\[\]$/, "").replace(/\?$/, "");
                if (MODELS.has(target)) continue;
                expect(
                    SQL_CORPUS.includes(`"${field.name}"`),
                    `column ${model}.${field.name} appears in no migration SQL — the schema would be ahead of the database`,
                ).toBe(true);
            }
        }
    });

    it("applies every migration folder that is not older than the oldest applied one", () => {
        expect(APPLIED_FOLDERS.length, "the apply script must list the SQL files it runs").toBeGreaterThan(0);
        const oldestApplied = [...APPLIED_FOLDERS].sort()[0];
        const skipped = MIGRATION_FOLDERS.filter(
            (folder) => folder > oldestApplied && !APPLIED_FOLDERS.includes(folder),
        );
        expect(
            skipped,
            `these migrations are newer than the oldest applied one but the build never applies them: ${skipped.join(", ")}`,
        ).toEqual([]);
    });
});