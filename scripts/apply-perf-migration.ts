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
    // Filter out chunks that are pure comments (every non-blank line is a
    // `--` line) so multi-line comment blocks preceding a statement don't
    // cause the statement itself to be dropped.
    const statements = raw
        .split(/;\s*\n/)
        .filter((s) =>
            s
                .split("\n")
                .some((line) => line.trim() && !line.trim().startsWith("--")),
        )
        .map((s) => s.trim());

    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        let applied = 0;
        let skipped = 0;
        for (const stmt of statements) {
            const preview = stmt.replace(/\s+/g, " ").slice(0, 100);
            try {
                await client.query(stmt);
                console.log(`✓ APPLIED: ${preview}${stmt.length > 100 ? "..." : ""}`);
                applied++;
            } catch (e) {
                // Migration file is missing some IF NOT EXISTS clauses; treat
                // PG "duplicate object" (42710) and "duplicate table" (42P07)
                // as a no-op so the script is idempotent. Match by message
                // too — Vercel's pg sometimes leaves `e.code` undefined.
                // Anything else fails.
                const err = e as { code?: string; message?: string };
                const code = err.code;
                const msg = err.message ?? String(e);
                const isAlreadyExists =
                    code === "42710" ||
                    code === "42P07" ||
                    /already exists|does not exist|duplicate|depend on/i.test(msg);
                if (isAlreadyExists) {
                    console.log(
                        `↷ SKIPPED (${code ?? "by-message"}): ${preview}${stmt.length > 100 ? "..." : ""}`,
                    );
                    skipped++;
                } else {
                    console.log(
                        `✗ FAILED (${code ?? "unknown"}): ${preview}${stmt.length > 100 ? "..." : ""}`,
                    );
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
        // Flush stdout/stderr so Vercel's build log captures the error line
        // before the process exits with code 1.
        if (process.stdout.writable) {
            await new Promise<void>((r) => process.stdout.once("drain", r));
        }
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
