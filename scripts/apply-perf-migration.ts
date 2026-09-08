import "dotenv/config";
import { readFileSync } from "fs";
import { Client } from "pg";

// Applies the perf migration's tsvector + GIN indexes + constraint changes
// that prisma db push can't manage (Unsupported("tsvector") is invisible to
// Prisma's introspection). Each statement runs in autocommit so
// CREATE INDEX CONCURRENTLY works. All statements are IF NOT EXISTS / IF
// EXISTS, so re-running is a no-op.

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }

    const sqlPath = "prisma/migrations/20260906181623_db_perf/migration.sql";
    const raw = readFileSync(sqlPath, "utf8");

    // Split on `;` at end of line so each statement runs in autocommit.
    // Strip `--` comment lines from each chunk first — otherwise a multi-line
    // comment block preceding a statement causes the statement to be dropped.
    const statements = raw
        .split(/;\s*\n/)
        .map((s) =>
            s
                .split("\n")
                .filter((line) => !line.trim().startsWith("--"))
                .join("\n")
                .trim(),
        )
        .filter((s) => s.length > 0);

    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        let applied = 0;
        let skipped = 0;
        for (const stmt of statements) {
            try {
                await client.query(stmt);
                applied++;
            } catch (e) {
                // Migration file is missing some IF NOT EXISTS clauses; treat
                // PG "duplicate object" (42710) and "duplicate table" (42P07)
                // as a no-op so the script is idempotent. Anything else fails.
                const code = (e as { code?: string }).code;
                if (code === "42710" || code === "42P07") {
                    skipped++;
                } else {
                    throw e;
                }
            }
        }
        console.log(
            `applied ${applied} statements (${skipped} skipped as already-existing) from ${sqlPath}`,
        );
    } catch (e) {
        console.error(
            "migration apply failed:",
            e instanceof Error ? e.message : e,
        );
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
