# Resolve CONCERNS.md — Design Spec

**Date:** 2026-08-05
**Branch:** `chore/resolve-concerns` off `development`
**Type:** Bug fixes + refactors + lint cleanup + doc-only concern
**Companion doc:** `docs/CONCERNS.md` (audit findings this PR resolves)

## Goal

Resolve every actionable item in `docs/CONCERNS.md` (Groups A–D plus the new
E5 concern) in a single mega-PR. Eliminate the 22 pre-existing lint errors,
fix the 5 correctness bugs, land the queued refactors, and codify the new
"both eslint AND tsc, no shortcut" rule into `CONCERNS.md` as E5.

## Non-goals

- The modernization work in `docs/superpowers/specs/2026-08-04-zefer-modernization-design.md`
  is owned by its own spec; this PR does not touch that surface.
- C1 (`src/lib` vs `src/utils` consolidation) is already done by the
  previous PR (`ef08845`).
- C2 (`constants.js` CJS/ESM) is owned by the modernization spec (Phase 0,
  Task 0.5).
- B10 (`toExclude` parameter) — finding retracted; no change.

## Out-of-band concerns

The new E5 concern (`AGENTS.md must require both eslint AND tsc`) is a
**doc-only** addition to `CONCERNS.md` (see "Doc-only changes" below). It
records an intent; the actual `AGENTS.md` file does not yet exist (per E1)
and is its own future task.

---

## Group A — Correctness bugs

### A1. `PostSlugWatcher` clears every timer in the window globally

**File:** `src/components/provider/PostSlugWatcher.tsx`

**Current behavior (broken):**
```ts
return () => {
    function clearAllTimeoutsAndIntervals() {
        var highestTimeoutId = setTimeout(";");          // eval-style, returns small ID
        for (let i = 0; i < highestTimeoutId; i++) clearTimeout(i);  // global sweep
        var highestIntervalId = setInterval(";");
        for (let i = 0; i < highestIntervalId; i++) clearInterval(i);
    }
    clearAllTimeoutsAndIntervals();
};
```

**Fix:** store timer IDs in refs created at mount, clear only those on unmount.

```ts
const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

// in handleScroll / addPostReadingLength:
intervals.current.push(setInterval(() => addPostReadingLength(), readTime));

// in cleanup:
intervals.current.forEach(clearInterval);
timers.current.forEach(clearTimeout);
intervals.current = [];
timers.current = [];
```

**Test:** manual smoke — verify scroll-tracking still works, no console
warnings about cleared foreign timers when navigating away.

**Risk:** low. The refactor only changes *which* IDs get cleared.

---

### A2. `auth.ts` callback uses non-null assertion `token.sub!`

**File:** `src/auth.ts:59`

**Current:**
```ts
session: ({ session, token }) => ({
    ...session,
    user: { ...session.user, id: token.sub! },
}),
```

**Fix:** throw when `token.sub` is missing. Auth.js v5 will surface the error
upstream and refuse to mint a session.

```ts
session: ({ session, token }) => {
    if (!token.sub) throw new Error("Missing token.sub in session callback");
    return { ...session, user: { ...session.user, id: token.sub } };
},
```

**Test:** manual — sign in with a malformed JWT, expect 401 / sign-out, not
a silent undefined user id.

**Risk:** low. The spec already requires "no non-null assertion" for
`session.user.id`. This aligns `token.sub` with that rule.

---

### A3. Typo in social-link name: `"Personal Webite"`

**File:** `src/app/(base-layout)/settings/profile/_components/Profile.tsx:140`

**Fix:** `"Personal Webite"` → `"Personal Website"` (one character).

**Test:** add a test asserting the form's "Personal Website" field shows the
stored URL on edit. Currently no test exists; add one using Playwright's
profile-edit flow.

**Risk:** trivial.

---

### A4. Typo in component name: `StautsNotif` → `StatusNotif`

**Files:**
- `src/components/StatusNotif.tsx:3` — rename export and file
- `src/components/wysiwyg/Tiptap.tsx:15` — update import
- `src/components/wysiwyg/Tiptap.tsx:655` — update JSX usage

**Fix:** rename `StautsNotif` → `StatusNotif` everywhere (file + 2 import
sites). Rename file to match (`StatusNotif.tsx` already correct, only the
internal export name changes).

**Test:** TS will catch any miss. No new test needed.

**Risk:** trivial.

---

### A5. `gemini-pro` model in `validateTag` is deprecated

**File:** `src/utils/actions/tag.ts:79`

**Current:** `genAI.getGenerativeModel({ model: "gemini-pro" })`

**Fix:** change to `gemini-1.5-flash-latest` to match `wysiwyg.ts:11`.

**Test:** existing e2e covers tag validation on publish. Manually verify
custom tags are accepted after the fix.

**Risk:** low. Behavior change is to *fix* a silent failure; the existing
fallback (`text?.includes("true")`) was rejecting all tags.

---

## Group B — Refactors

### B1. Merge `PostReactionButton` + `CommentReactionButton` into one generic component

**Files:**
- `src/components/reactions/actions/PostReactionButton.tsx` (~102 LOC)
- `src/components/reactions/actions/CommentReactionButton.tsx` (~108 LOC)

**Approach:** extract a single `ReactionButton<T>` that takes:
- `target: { id: string; authorId: string }` (post or comment)
- `targetType: "post" | "comment"`
- `notificationMessage: (actorName: string) => string`

Internals dispatch to the right `getReaction` / `toggleReaction` / `delete`
helpers. The two callers pass the target type and the message template.

**Notification message templates** (verified from current source):
- Post: `"has reacted with ❤️ to your post"`
- Comment: `"has reacted with ❤️ to your comment on your post"`

**Test:** snapshot test of notification payload before/after the merge for
both target types.

**Estimated savings:** ~100 LOC.

---

### B2. Generic `useInfiniteList<T>` hook

**Files:**
- `src/components/post/PostList.tsx` (208 LOC)
- `src/components/people/PeopleList.tsx` (101 LOC)

**Approach:** extract a hook that takes:
- `queryKey: string[]`
- `fetcher: (cursor) => Promise<{ items: T[]; nextCursor?: string }>`
- `getNextPageParam` (default: last item's cursor)
- `enabled?: boolean`

Returns `{ items, ref, isLoading, isError, fetchNextPage, hasNextPage }`.
`PostList` keeps its feed-sort toggle and "no results" UI as caller-side
wrapping; `PeopleList` becomes near-trivial.

**`TagList` is excluded** — it uses `useEffect` + raw `fetch`, not
react-query. Out of scope.

**Test:** integration test on PostList feed toggle (already covered by
`tests/feed.spec.ts`; verify it still passes).

**Estimated savings:** ~80 LOC.

---

### B3. Generic reaction action helpers

**File:** `src/utils/actions/reactions.ts` (146 LOC)

**Approach:** collapse the 3 pairs of identical Prisma ops:

```ts
async function getReaction(target: ReactionTarget, key: string) { ... }
async function toggleReaction(target: ReactionTarget, key: string, type: ReactionType) { ... }
async function deleteReaction(target: ReactionTarget, key: string) { ... }
```

Preserve the named exports by keeping thin wrappers:
`updateCreatePostReaction(id, t) → toggleReaction("post", id, t)`. Call sites
do not change.

**Test:** existing reaction e2e covers this; verify it still passes.

**Estimated savings:** ~75 LOC.

---

### B4. `formatPostDate` helper

**Files:**
- `src/components/post/PostContainer.tsx:109-122`
- `src/app/(base-layout)/[userId]/[slug]/page.tsx:248-279`

**Approach:** extract the duplicated `toLocaleDateString` config + "is this
year" branching into `src/utils/formatPostDate.ts`. Both callers import it.

**Test:** snapshot test of rendered date strings in both components for a
fixed timestamp and locale.

**Estimated savings:** ~25 LOC.

---

### B5. Inline Cloudinary draft-cover fetch via `uploadCloudinary`

**File:** `src/app/api/post/draft/route.ts:121-150`

**Approach:** the manual signature+fetch block re-implements
`uploadCloudinary`. Replace with a call to the existing helper, passing
`options.folder: "zefer/post/draft"`.

**Test:** manual — upload a draft cover, verify it lands in Cloudinary under
`zefer/post/draft`.

**Estimated savings:** ~30 LOC.

---

### B6. Collapse `api/post/route.ts` 170-line relevance block

**File:** `src/app/api/post/route.ts:124-291`

**Approach (paired with B9):**
1. First split the file: extract `buildWhere()`, `buildOrderBy()`, `paginate()`
   into a sibling `src/app/api/post/_query.ts` file (private to the route).
2. Move the relevance ranking into a **new** `src/utils/services/ranking.ts`
   file (a unified ranking service). The three existing ranking
   implementations (`api/post/route.ts:124-291`, `actions/tag.ts:getTagRankings`,
   `api/cron/route.ts:tagRanks()`) become callers of this single service that
   returns a unified shape.
3. The route's `orderBy === "relevance"` branch becomes a thin call into the
   service.

**Test:** snapshot test of ranking output for a fixed seed dataset. Verify
the route returns the same posts in the same order before/after.

**Risk:** high — three ranking implementations disagree on details. Carefully
review the union of inputs/outputs before collapsing. Verify production
rankings against current output with a side-by-side test.

**Estimated savings:** ~120 LOC.

---

### B7. `timeDiffCalc` → `Intl.RelativeTimeFormat`

**File:** `src/utils/timeDiffCalc.ts`

**Approach:** rewrite using `new Intl.RelativeTimeFormat(locale, { numeric: "auto" })`.
Note: **user-visible strings change** — "1 month ago" → "last month" in
en-US. Confirmed as in-scope.

**Test:** locale-aware snapshot tests for `en-US`, `pt-BR`, `ja-JP`.

**Estimated savings:** ~16 LOC.

---

### B8. `randomNumberGen4Digit` / `generateRandomCode` → `crypto.randomInt`

**Files:**
- `src/utils/randomNumberGen4Digit.ts`
- `src/app/api/post/route.ts:362-373` (`generateRandomCode`)

**Approach:**
- `randomNumberGen4Digit()` → `crypto.randomInt(1000, 10000)` (1 line)
- `generateRandomCode()` → `crypto.randomBytes(2).toString("base64url").slice(0,4)` (1 line)

Delete the helper files.

**Test:** no test needed — `crypto.randomInt` is the stdlib replacement.

**Estimated savings:** ~12 LOC.

---

### B9. Remove inline `PrismaQuery` interfaces — paired with B6

**Files:**
- `src/app/api/post/route.ts:25-39`
- `src/app/api/post/manage/series/post/route.ts:5-13`

**Approach:** replace the hand-rolled interface with
`Prisma.PostFindManyArgs`. The array-vs-object `orderBy` (needed by the
relevance branch) gets a discriminated union type. The conditional mutation
blocks (`prismaQuery.where = { ... }`) move into the `buildWhere()` /
`buildOrderBy()` helpers extracted in B6 step 1.

**Risk:** medium — TS will surface errors in the mutation blocks; fix them
inline as part of the same commit.

**Estimated savings:** ~15 LOC.

---

### B10. `toExclude` parameter — KEEP

No change. The audit finding was retracted. The exclusion is load-bearing
for the customized Image/Link/Youtube extensions in `Tiptap.tsx:127`.

---

## Group C — Cosmetic

### C1. `src/lib/` vs `src/utils/` consolidation — DONE

Already done in commit `ef08845`. No action.

### C2. `constants.js` CJS/ESM — OUT OF SCOPE

Owned by modernization spec (Phase 0, Task 0.5).

### C3. `next-auth.d.ts` eslint-disable comment

**File:** `next-auth.d.ts:4`

**Fix:** remove the comment:
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```
The disable is for a phantom warning that doesn't fire in current TS.

**Risk:** trivial — TS verifies the file still compiles.

---

## Group D — Pre-existing lint failures

**Current state:** 22 pre-existing lint errors after commit `ef08845`.
Concentrated in `src/components/wysiwyg/Tiptap.tsx` (~20 errors, all React 19
strict-rule violations). One in `next-auth.d.ts` (resolved by C3).

**Approach:**
1. Decompose `Tiptap.tsx` (769 lines) into smaller components:
   - `useAutosave` hook → `src/components/wysiwyg/hooks/useAutosave.ts`
   - `ImageUploadForm` → `src/components/wysiwyg/ImageUploadForm.tsx`
   - `TagInput` → `src/components/wysiwyg/TagInput.tsx`
   - `PostStatusBanner` → `src/components/wysiwyg/PostStatusBanner.tsx`
2. Each extracted module gets a render test using **React Testing Library**
   (add `@testing-library/react` and `@testing-library/jest-dom` to
   `package.json` devDependencies — vitest is the default test runner; add it
   too if not already present).
3. After decomposition, fix the remaining strict-rule errors in Tiptap.tsx
   itself (mostly `react-hooks/rules-of-hooks` and
   `react/no-unstable-nested-components`).

**Risk:** medium. Decomposing Tiptap.tsx is non-trivial because the component
uses many closure-bound helpers. Verify all existing behavior with the
Playwright e2e (`tests/feed.spec.ts`) and any post-creation tests.

**Estimated savings:** net ~-100 LOC after the decomposition + lint cleanup.

**Test setup:** introduce React Testing Library + vitest for the extracted
subcomponents. Add `@testing-library/react`, `@testing-library/jest-dom`,
and `vitest` to `package.json` devDependencies.

---

## Group E — Doc-only

### E5. AGENTS.md must require BOTH eslint AND tsc (NEW)

**File:** `docs/CONCERNS.md`

**Add a new entry under "Group E — Worth flagging to the user":**

```markdown
### E5. Future AGENTS.md must require BOTH `eslint` AND `tsc` — no tsc shortcut

**File (future):** `AGENTS.md` (does not exist yet; see E1)

**Verified:** `npm run lint` currently combines `eslint . && npx tsc --noemit`
into one script. Agents and contributors often run only `npx tsc --noEmit`
and skip eslint — which is exactly how the 22 pre-existing lint errors in
Tiptap.tsx (Group D) accumulated: every PR passed `tsc` and merged.

**Requirement:** any future `AGENTS.md` (or `CLAUDE.md`) must codify that
**both** gates are part of the pre-completion checklist:
- `npx eslint .` — exit 0
- `npx tsc --noEmit` — exit 0

Running only one is not sufficient. This is the rule that would have
prevented the Group D lint debt from accumulating in the first place.

**Status:** doc-only entry. AGENTS.md does not yet exist (E1); this records
the intent so the future author of AGENTS.md picks it up.
```

---

## Verification gate

**Per the new E5 concern, the pre-merge final state must satisfy:**

```bash
npx eslint .                  # exit 0
npx tsc --noEmit              # exit 0
```

Run **separately**, not via `npm run lint`. (If either fails, the combined
script fails too, but the separate runs surface which one failed for
debugging.)

**Per-commit gate:**
- **`npx tsc --noEmit`** must remain green on every commit.
- **`npx eslint .`** is allowed to carry the 22 pre-existing errors for
  commits 1-13 (the A/B/C3/before-D commits). The D commit (commit 14)
  must bring the lint count to **zero**. Commits 1-13 must not *add* any
  new lint errors beyond the 22 baseline.

**Pre-merge final check:**

```bash
npm run lint                  # combined gate, exit 0
npm run build                 # route collection + bundle, exit 0
```

---

## Commit shape (final)

15 commits in the order listed in the design summary. Each is
independently revertable. Target final diff: ~-500 lines across ~30 files.

---

## Risk register

| Risk | Mitigation |
|------|-----------|
| B6 ranking output changes | Side-by-side snapshot test before/after; verify on a production-shaped seed. |
| B7 string output changes | Locale-aware snapshot tests; design sign-off recorded. |
| B9 surfaces new TS errors | Fix inline as part of the same commit; review before merge. |
| D extraction breaks Tiptap.tsx behavior | Playwright e2e (`tests/feed.spec.ts`) + post-creation tests as final gate. |
| Mega-PR is hard to review | 16 logical commits, each independently reviewable; PR description lists the commit order with one-line summaries. |

---

## Out of scope

- AGENTS.md file creation itself (E1 — future doc pass).
- Modernization work (auth/middleware/Tailwind/Next 16 upgrade — separate spec).
- Any new lint rule additions to `eslint.config.mjs` beyond what the React 19
  strict rules require.
