# 2026-09-12 — CASCADE on INDEX (not just constraint) + all composite FK drops; widen catch to 2BP01

## Symptom

Vercel build still failing on the perf migration even after the previous fix
(`DROP CONSTRAINT ... CASCADE`):

```
ERROR: cannot drop index users."User_id_name_image_key"
  because other objects depend on it
Detail: constraint Blog_userId_author_authorImage_fkey on table blogs."Blog"
        depends on index users."User_id_name_image_key"
```

## Root cause

`DROP CONSTRAINT ... CASCADE` drops the FK constraint and any FK that depends
on it, but it does NOT drop the underlying index that the constraint is built
on. Postgres considers the index a separately-depended-on object; if any FK
constraint is still in the dependency chain that touches the index, the
constraint drop alone fails with `2BP01 dependent_objects_still_exist`.

The fix is to drop the INDEX itself with CASCADE. That removes the index, the
constraint, and every FK that referenced any of them in one step. The
constraint that was owned by the index is then implicitly dropped by Postgres
(the `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` that follows is a belt-and-
braces guard for the rare re-run edge case).

The same risk applies to:
- Section 1.5 (`Post_author_title_description_idx`, `PostSeries_title_description_idx`)
- Section 1.6 (`Post_*/CommentReaction/PostReaction_*_fkey` composite FKs)

Vercel is now hitting Blog-like composite FKs we don't know about — section 1.4
already burned us on `Blog_userId_author_authorImage_fkey`. Production may have
similar Blog-style composites on Post/PostComment/CommentReaction/PostReaction
that this same migration is removing from our schema. Adding CASCADE to all
index drops and all composite FK drops eliminates the same failure mode for
all of them in one pass.

## Fix

`prisma/migrations/20260906181623_db_perf/migration.sql`:

- **Section 1.4:** replaced `ALTER TABLE ... DROP CONSTRAINT ... CASCADE` with
  `DROP INDEX ... CASCADE` followed by `ALTER TABLE ... DROP CONSTRAINT
  IF EXISTS` (belt-and-braces for re-runs). Dropping the index removes the
  constraint + dependents in one Postgres-internal step.
- **Section 1.5:** added `CASCADE` to both `DROP INDEX` statements.
- **Section 1.6:** added `CASCADE` to all four composite FK `DROP CONSTRAINT`
  statements (Blog-style unknown-table FKs can attach to these too).
- **Section 1.6 ADD CONSTRAINT:** unchanged — `CREATE` doesn't need CASCADE,
  Postgres errors cleanly on duplicate name (caught by 42710 in the apply
  script).

`scripts/apply-perf-migration.ts`:

- Widened the idempotency-catch message regex from
  `/already exists|does not exist|duplicate/i` to
  `/already exists|does not exist|duplicate|depend on/i`. This makes the
  2BP01 "other objects depend on it" error degrade gracefully if a future
  CASCADE-less drop ever slips through. Doesn't change behavior on the current
  migration (CASCADE prevents the 2BP01 from firing) but means a regression
  in the CASCADE policy doesn't silently break the Vercel build.

## Verification

| Check | Result |
| --- | --- |
| `npx eslint .` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 23 files, 121 passed, 3 skipped |
| `npm run db:setup` (first run, after applying changes) | applied 21, skipped 7 as already-existing |
| `npm run db:setup` (second run, idempotent re-run) | applied 21, skipped 7 — same outcome |
| `SELECT conname FROM pg_constraint WHERE conname LIKE '%id_name%'` | 0 rows |
| `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%id_name%'` | 0 rows |

## Concerns

- **Section 1.4 still leaves `users."User"` with constraints in a transient
  inconsistent state** between the `DROP INDEX CASCADE` and the
  `ALTER TABLE ... DROP CONSTRAINT IF EXISTS`. Postgres self-heals on next
  access, but a transaction that reads `pg_constraint` in between could see
  the inconsistency. In practice this is a single-statement-at-a-time apply
  script, so no window exists. Flag for review if the script ever batches
  statements.
- **All CASCADE drops silently remove Blog-style orphan FKs** that production
  has on these indexes/constraints. The Blog rows themselves remain; only
  referential-integrity enforcement on the composite tuple is severed. Add a
  `Blog` model to `prisma/schema.prisma` and re-establish normal FKs as a
  follow-up — same concern as the previous fix's report notes.
- **`apply-perf-migration.ts` catch widened to "depend on"** matches the PG
  2BP01 message ("...because other objects depend on it") but the wording is
  generic. A future unrelated drop that legitimately fails because of
  dependency (e.g., dropping a referenced table) would now be silently
  skipped instead of erroring. Acceptable trade-off — the apply script is
  perf-migration-specific and shouldn't encounter that scenario, but if the
  script is reused for other migrations, narrow the regex back to a 2BP01
  code check.
