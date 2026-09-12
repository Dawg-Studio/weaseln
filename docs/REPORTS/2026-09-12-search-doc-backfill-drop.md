# 2026-09-12 — drop `search_doc` backfill UPDATE (Neon 57P01)

## Trigger

Vercel deploy failed with PostgreSQL `57P01 admin_shutdown` mid-migration. Neon
killed the connection while running the full-table `UPDATE posts."Post" SET
"search_doc" = ...` backfill in
`prisma/migrations/20260906181623_db_perf/migration.sql`.

Neon has aggressive statement timeouts; a per-row `to_tsvector` over the full
Post table exceeds them. The trigger is enough to keep `search_doc` correct
going forward — the backfill was a nice-to-have.

## Change

Removed the backfill block (and its comment) from the migration:

```sql
-- Backfill existing rows: set search_doc for all current Post rows so the
-- FTS index is useful immediately on prod.
UPDATE posts."Post" SET "search_doc" =
    setweight(to_tsvector('english', coalesce("title",       '')), 'A')
 || setweight(to_tsvector('english', coalesce("description", '')), 'B')
 || setweight(to_tsvector('english', coalesce("author",      '')), 'C');
```

Trigger (`Post_search_doc_set`, BEFORE INSERT OR UPDATE OF title/description/author)
still populates the column for all writes after deploy.

## Trade-off

Existing Post rows have `NULL search_doc` until they are next edited
(title/description/author change). The GIN index still works — `to_tsquery`
just won't match those rows. **Flag for a follow-up backfill job** after this
ship lands. Options:

- One-shot `prisma.$executeRaw` script run from a worker (no migration context)
  that updates in batches with `LIMIT` and a sleep to stay under Neon's timeout.
- `NOT VALID` then `VALIDATE CONSTRAINT`-style: do it in 1k-row batches over a
  few cron ticks instead of one transaction.

## Verification

- `npx eslint .` — exit 0
- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 23 files, 121 passed, 3 skipped, 0 failed
  (log: `docs/REPORTS/test-perf-fix.log`)
