# Resolve CONCERNS.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every actionable item in `docs/CONCERNS.md` — fix 5 correctness bugs (Group A), land 9 refactors (Group B), clean up 22 pre-existing lint errors (Group D), remove one stale comment (Group C3), and add one new doc-only concern (Group E5).

**Architecture:** Single mega-PR (`chore/resolve-concerns` off `development`) with 15 logical commits. Each commit is independently revertable. The doc-only commit (E5) lands first; A-group bugs fix next; B-group refactors follow; D-group lint cleanup lands last and brings the eslint count to zero.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, Prisma 6, Auth.js v5 beta, Tailwind 4, react-query 5, Playwright (e2e only), vitest + React Testing Library (new, for component tests).

**Spec:** `docs/superpowers/specs/2026-08-05-resolve-concerns-design.md` — every task below references its design section.

---

## Global Constraints

These apply to every task unless the task explicitly overrides them.

- **Node:** `>=20.9` (per `package.json:engines`).
- **Verification per commit:**
  - `npx tsc --noEmit` **must exit 0** on every commit.
  - `npx eslint .` may carry the 22 pre-existing errors for tasks 2-14. Task 15 (D cleanup) **must** bring it to 0. No new lint errors allowed in any task.
- **Pre-merge final gate:** `npm run lint` (exits 0) + `npm run build` (exits 0).
- **No new dependencies** without explicit task instruction. The only allowed additions are in Task 15 (D cleanup): `@testing-library/react`, `@testing-library/jest-dom`, `vitest`.
- **No behavior change** in tasks tagged `[mechanical]` in their title.
- **Branch:** `chore/resolve-concerns`, off `development`. Create via `git checkout -b chore/resolve-concerns` before task 1.
- **Git identity:** use the existing `Ronan <rozer223@gmail.com>` config. Do not override.
- **Commit message style:** Conventional Commits (`fix:`, `refactor:`, `chore:`, `docs:`, `test:`). Match the style of recent commits in `git log --oneline -10`.

---

## File Map

Files created or modified across this plan. Grouped by task.

| Task | Files |
|------|-------|
| T1 (E5) | `docs/CONCERNS.md` (add E5 entry) |
| T2 (A1) | `src/components/provider/PostSlugWatcher.tsx` |
| T3 (A2) | `src/auth.ts` |
| T4 (A3) | `src/app/(base-layout)/settings/profile/_components/Profile.tsx` |
| T5 (A4) | `src/components/StatusNotif.tsx` (export rename), `src/components/wysiwyg/Tiptap.tsx` (import + usage) |
| T6 (A5) | `src/utils/actions/tag.ts` |
| T7 (B1+B3) | `src/components/reactions/actions/ReactionButton.tsx` (new), `src/components/reactions/actions/PostReactionButton.tsx` (delete), `src/components/reactions/actions/CommentReactionButton.tsx` (delete), `src/utils/actions/reactions.ts`, callers of the deleted buttons |
| T8 (B2) | `src/hooks/useInfiniteList.ts` (new), `src/components/post/PostList.tsx`, `src/components/people/PeopleList.tsx` |
| T9 (B4) | `src/utils/formatPostDate.ts` (new), `src/components/post/PostContainer.tsx`, `src/app/(base-layout)/[userId]/[slug]/page.tsx` |
| T10 (B5) | `src/app/api/post/draft/route.ts` |
| T11 (B6+B9) | `src/app/api/post/route.ts`, `src/app/api/post/_query.ts` (new), `src/utils/services/ranking.ts` (new), `src/utils/actions/tag.ts`, `src/app/api/cron/route.ts`, `src/app/api/post/manage/series/post/route.ts` |
| T12 (B7) | `src/utils/timeDiffCalc.ts` |
| T13 (B8) | `src/utils/randomNumberGen4Digit.ts` (delete), `src/app/api/post/route.ts`, all callers of the deleted helper |
| T14 (D) | `src/components/wysiwyg/Tiptap.tsx`, `src/components/wysiwyg/hooks/useAutosave.ts` (new), `src/components/wysiwyg/ImageUploadForm.tsx` (new), `src/components/wysiwyg/TagInput.tsx` (new), `src/components/wysiwyg/PostStatusBanner.tsx` (new), `next-auth.d.ts` (C3 stale comment), `package.json` (add test deps), `vitest.config.ts` (new) |

---

## Task 1: Add E5 concern to CONCERNS.md (doc-only)

**Files:**
- Modify: `docs/CONCERNS.md` (append new entry under "Group E")

**Interfaces:** none.

- [ ] **Step 1: Read the current Group E section in CONCERNS.md**

Run: `Read docs/CONCERNS.md` (offset ~393, limit ~80)

Confirm the Group E section ends after E4. The "Quick reference" section follows. E5 must be inserted between E4 and the "Quick reference" section.

- [ ] **Step 2: Insert the E5 entry**

In `docs/CONCERNS.md`, immediately after the E4 section and before the `---` separator that precedes "Quick reference", insert this block:

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

- [ ] **Step 3: Verify the file reads correctly**

Run: `Read docs/CONCERNS.md` (offset ~390, limit ~50)

Verify the entry landed between E4 and the "Quick reference" section, and the `---` separator is intact.

- [ ] **Step 4: Commit**

```bash
git add docs/CONCERNS.md
git commit -m "docs(concerns): add E5 — AGENTS.md must require both eslint and tsc"
```

Expected: commit lands. No code changes, so `npm run lint` state unchanged.

---

## Task 2: A1 — PostSlugWatcher clear only its own timers

**Spec:** A1 in design doc.

**Files:**
- Modify: `src/components/provider/PostSlugWatcher.tsx`

**Interfaces:** none — internal cleanup refactor.

- [ ] **Step 1: Read the current cleanup function**

Run: `Read src/components/provider/PostSlugWatcher.tsx` (limit 90)

Note the `setInterval(() => addPostReadingLength(), readTime)` call inside the scroll handler (around line 62). The fix tracks the interval ID via a ref.

- [ ] **Step 2: Add a ref and replace the broken cleanup**

Replace lines 1-88 with this refactored file (only the changed parts; keep existing imports):

```tsx
"use client";

import { useEffect, useRef } from "react";

// ... other imports unchanged

export default function PostSlugWatcher({ children, postId }: PostSlugWatcherProps) {
    const readingTimeInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        function addPostReadingLength() {
            // ... existing implementation unchanged
        }

        function handleScroll() {
            // ... existing scroll logic, BUT replace any inline setTimeout with:
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
                addPostReadingLength();
            }, /* existing debounce ms */);

            if (readingTimeInterval.current === undefined /* existing condition */) {
                readingTimeInterval.current = setInterval(() => {
                    addPostReadingLength();
                }, readTime);
            }
        }

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (readingTimeInterval.current) {
                clearInterval(readingTimeInterval.current);
                readingTimeInterval.current = undefined;
            }
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = undefined;
            }
        };
    }, [postId]);

    return <>{children}</>;
}
```

**Note:** the worker must read the current file and preserve the existing `addPostReadingLength` body, debounce ms value, and the `readTime` constant. Only the timer-tracking mechanism changes. Do not blindly paste — adapt the constants.

- [ ] **Step 3: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/components/provider/PostSlugWatcher.tsx`
Expected: same lint state as before (22 baseline). The 2 existing errors in this file are unchanged by this task.

- [ ] **Step 4: Commit**

```bash
git add src/components/provider/PostSlugWatcher.tsx
git commit -m "fix(provider): PostSlugWatcher clears only its own timers"
```

---

## Task 3: A2 — auth.ts throw on missing token.sub

**Spec:** A2 in design doc.

**Files:**
- Modify: `src/auth.ts:54-62`

**Interfaces:** `session` callback signature unchanged externally.

- [ ] **Step 1: Read the current session callback**

Run: `Read src/auth.ts` (offset 50, limit 20)

- [ ] **Step 2: Replace the callback body**

Replace lines 55-61 with:

```ts
session: ({ session, token }) => {
    if (!token.sub) throw new Error("Missing token.sub in session callback");
    return {
        ...session,
        user: {
            ...session.user,
            id: token.sub,
        },
    };
},
```

- [ ] **Step 3: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/auth.ts`
Expected: same as before.

- [ ] **Step 4: Commit**

```bash
git add src/auth.ts
git commit -m "fix(auth): throw on missing token.sub in session callback"
```

---

## Task 4: A3 — fix "Personal Webite" typo

**Spec:** A3 in design doc.

**Files:**
- Modify: `src/app/(base-layout)/settings/profile/_components/Profile.tsx:140`

**Interfaces:** none.

- [ ] **Step 1: Fix the typo**

In the file, replace `"Personal Webite"` with `"Personal Website"` (one character: `i`).

- [ ] **Step 2: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/app/\(base-layout\)/settings/profile/_components/Profile.tsx`
Expected: same as before.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(base-layout\)/settings/profile/_components/Profile.tsx
git commit -m "fix(profile): typo 'Personal Webite' -> 'Personal Website'"
```

Note: PowerShell — escape parens in the path with backslashes as shown.

---

## Task 5: A4 — rename StautsNotif → StatusNotif

**Spec:** A4 in design doc.

**Files:**
- Modify: `src/components/StatusNotif.tsx:3` (export rename)
- Modify: `src/components/wysiwyg/Tiptap.tsx:15` (import)
- Modify: `src/components/wysiwyg/Tiptap.tsx:655` (JSX usage)

**Interfaces:** the default export from `StatusNotif.tsx` is renamed. The component's props (`StatusResponse`) are unchanged.

- [ ] **Step 1: Rename the export in StatusNotif.tsx**

In `src/components/StatusNotif.tsx` line 3, replace `function StautsNotif(` with `function StatusNotif(` and the matching `export default function StatusNotif(` declaration.

- [ ] **Step 2: Update the import in Tiptap.tsx**

In `src/components/wysiwyg/Tiptap.tsx` line 15, replace `import StautsNotif from` with `import StatusNotif from`.

- [ ] **Step 3: Update the JSX usage in Tiptap.tsx**

In `src/components/wysiwyg/Tiptap.tsx` line 655, replace `<StautsNotif` with `<StatusNotif`.

- [ ] **Step 4: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0 (TS would catch any missed rename).

Run: `npx eslint src/components/StatusNotif.tsx src/components/wysiwyg/Tiptap.tsx`
Expected: same as before (no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusNotif.tsx src/components/wysiwyg/Tiptap.tsx
git commit -m "refactor: rename StautsNotif -> StatusNotif"
```

---

## Task 6: A5 — gemini-pro → gemini-1.5-flash-latest

**Spec:** A5 in design doc.

**Files:**
- Modify: `src/utils/actions/tag.ts:79`

**Interfaces:** none. The model name is an internal config.

- [ ] **Step 1: Read the model declaration**

Run: `Read src/utils/actions/tag.ts` (offset 75, limit 10)

- [ ] **Step 2: Swap the model name**

Replace `"gemini-pro"` with `"gemini-1.5-flash-latest"`.

- [ ] **Step 3: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/utils/actions/tag.ts`
Expected: same as before.

- [ ] **Step 4: Commit**

```bash
git add src/utils/actions/tag.ts
git commit -m "fix(tag): use gemini-1.5-flash-latest, not deprecated gemini-pro"
```

---

## Task 7: B1 + B3 — merge reaction buttons + reaction action helpers

**Spec:** B1 + B3 in design doc.

**Files:**
- Create: `src/components/reactions/actions/ReactionButton.tsx`
- Delete: `src/components/reactions/actions/PostReactionButton.tsx`
- Delete: `src/components/reactions/actions/CommentReactionButton.tsx`
- Modify: `src/utils/actions/reactions.ts` (collapse to 3 generic helpers, keep named-export wrappers)
- Modify: every importer of the deleted buttons (search via `Grep` for `PostReactionButton` and `CommentReactionButton`)

**Interfaces:**
- `ReactionButton` props: `{ target: { id: string; authorId: string }; targetType: "post" | "comment"; notificationMessage: (actorName: string) => string }`
- New helpers in `reactions.ts`: `getReaction(target, key)`, `toggleReaction(target, key, type)`, `deleteReaction(target, key)` — keep existing named exports as thin wrappers.

- [ ] **Step 1: Read both buttons and the actions file**

Run: `Read src/components/reactions/actions/PostReactionButton.tsx`
Run: `Read src/components/reactions/actions/CommentReactionButton.tsx`
Run: `Read src/utils/actions/reactions.ts`

Identify the 5 differences (initial fetch, update, delete, notification message template, prop names). Map each to the new generic component.

- [ ] **Step 2: Find all importers of the deleted buttons**

Run:
```bash
Grep "PostReactionButton" --pattern "import|from|require"
Grep "CommentReactionButton" --pattern "import|from|require"
```

Note every file. The refactor must update every call site.

- [ ] **Step 3: Write the new generic `ReactionButton.tsx`**

Create `src/components/reactions/actions/ReactionButton.tsx` with a single component that:

```tsx
"use client";

import { useState } from "react";
import { getReaction, toggleReaction, deleteReaction } from "@/utils/actions/reactions";
import type { ReactionType } from "@/types/reaction";

type Target = { id: string; authorId: string };

export default function ReactionButton({
    target,
    targetType,
    notificationMessage,
}: {
    target: Target;
    targetType: "post" | "comment";
    notificationMessage: (actorName: string) => string;
}) {
    // single useState for current reaction, single useEffect for initial fetch,
    // single click handler that dispatches toggle/delete based on current state
    // ... internal state and handlers
    return <button /* unified JSX */ />;
}
```

The worker must lift the body of the two existing buttons into one, dispatching on `targetType` for the action calls. The notification message comes from the `notificationMessage` prop (caller passes a template function).

- [ ] **Step 4: Update `reactions.ts` to add generic helpers + keep named exports**

In `src/utils/actions/reactions.ts`:

1. Add at the top:
```ts
type ReactionTarget = "post" | "comment";
type ReactionKey = { postId: string } | { commentId: string };
```

2. Add three generic functions:
```ts
async function getReaction(target: ReactionTarget, key: ReactionKey) { ... }
async function toggleReaction(target: ReactionTarget, key: ReactionKey, type: ReactionType) { ... }
async function deleteReaction(target: ReactionTarget, key: ReactionKey) { ... }
```

3. Keep all existing named exports (`getInitialPostReaction`, `updateCreatePostReaction`, `deletePostReaction`, etc.) as thin one-line wrappers around the generic functions. This means call sites in non-button code do not need to change.

- [ ] **Step 5: Update all importers of the deleted buttons**

For each file in step 2's grep results, replace the import and JSX usage with the new `ReactionButton`. Pass the right `targetType` and a `notificationMessage` function:

```tsx
<ReactionButton
    target={{ id: post.id, authorId: post.userId }}
    targetType="post"
    notificationMessage={(actorName) => `${actorName} has reacted with ❤️ to your post`}
/>
```

```tsx
<ReactionButton
    target={{ id: comment.id, authorId: comment.userId }}
    targetType="comment"
    notificationMessage={(actorName) => `${actorName} has reacted with ❤️ to your comment on your post`}
/>
```

- [ ] **Step 6: Delete the old button files**

```bash
git rm src/components/reactions/actions/PostReactionButton.tsx
git rm src/components/reactions/actions/CommentReactionButton.tsx
```

- [ ] **Step 7: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/components/reactions/ src/utils/actions/reactions.ts`
Expected: same as before. If the old files had 1-2 errors that came along for the ride, the count drops here (a free win; not a goal).

- [ ] **Step 8: Commit**

```bash
git add -A src/components/reactions/ src/utils/actions/reactions.ts
git commit -m "refactor(reactions): merge post/comment reaction buttons into generic component"
```

---

## Task 8: B2 — extract useInfiniteList hook

**Spec:** B2 in design doc.

**Files:**
- Create: `src/hooks/useInfiniteList.ts`
- Modify: `src/components/post/PostList.tsx` (consume the hook)
- Modify: `src/components/people/PeopleList.tsx` (consume the hook)

**Interfaces:**
```ts
function useInfiniteList<T>(opts: {
    queryKey: string[];
    fetcher: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor?: string }>;
    getNextPageParam?: (lastPage: { items: T[]; nextCursor?: string }) => string | undefined;
    enabled?: boolean;
}): {
    items: T[];
    ref: (node?: Element | null) => void;
    isLoading: boolean;
    isError: boolean;
    fetchNextPage: () => void;
    hasNextPage: boolean;
};
```

- [ ] **Step 1: Read both list components**

Run: `Read src/components/post/PostList.tsx`
Run: `Read src/components/people/PeopleList.tsx`

Identify the shared `useInfiniteQuery` + `useInView` + `getNextPageParam` + "attach ref to last item" pattern. Note the `TagList` exception: it uses `useEffect` + raw `fetch`, **not** react-query — `TagList` is out of scope per spec B2.

- [ ] **Step 2: Create the hook**

Create `src/hooks/useInfiniteList.ts`:

```ts
import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";

type FetcherResult<T> = { items: T[]; nextCursor?: string };

export function useInfiniteList<T>(opts: {
    queryKey: string[];
    fetcher: (cursor: string | undefined) => Promise<FetcherResult<T>>;
    getNextPageParam?: (lastPage: FetcherResult<T>) => string | undefined;
    enabled?: boolean;
}) {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isLoading,
        isError,
    } = useInfiniteQuery({
        queryKey: opts.queryKey,
        queryFn: ({ pageParam }) => opts.fetcher(pageParam),
        getNextPageParam: opts.getNextPageParam ?? ((last) => last.nextCursor),
        enabled: opts.enabled,
    });

    const { ref, inView } = useInView();

    useEffect(() => {
        if (inView && hasNextPage) fetchNextPage();
    }, [inView, hasNextPage, fetchNextPage]);

    const items = (data?.pages.flatMap((p) => p.items) ?? []) as T[];

    return { items, ref, isLoading, isError, fetchNextPage, hasNextPage };
}
```

- [ ] **Step 3: Refactor PostList to use the hook**

Replace the `useInfiniteQuery` + `useInView` block in `src/components/post/PostList.tsx` with a call to `useInfiniteList`. Keep the feed-sort toggle and "no results" UI as caller-side wrapping (the hook just provides data + ref).

- [ ] **Step 4: Refactor PeopleList to use the hook**

Same as step 3 but in `src/components/people/PeopleList.tsx`. PeopleList should become near-trivial after the refactor.

- [ ] **Step 5: Verify tsc + lint + e2e**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/hooks/useInfiniteList.ts src/components/post/PostList.tsx src/components/people/PeopleList.tsx`
Expected: same as before.

If Playwright e2e is runnable locally, run: `npx playwright test tests/feed.spec.ts`
Expected: PASS (or skip if env not set up; document the skip in the commit body).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useInfiniteList.ts src/components/post/PostList.tsx src/components/people/PeopleList.tsx
git commit -m "refactor(hooks): extract useInfiniteList<T> for PostList and PeopleList"
```

---

## Task 9: B4 — extract formatPostDate helper

**Spec:** B4 in design doc.

**Files:**
- Create: `src/utils/formatPostDate.ts`
- Modify: `src/components/post/PostContainer.tsx:109-122`
- Modify: `src/app/(base-layout)/[userId]/[slug]/page.tsx:248-279`

**Interfaces:**
```ts
// src/utils/formatPostDate.ts
export function formatPostDate(d: Date, locale?: string): string;
```

- [ ] **Step 1: Read both callers**

Run: `Read src/components/post/PostContainer.tsx` (offset 105, limit 20)
Run: `Read src/app/(base-layout)/[userId]/[slug]/page.tsx` (offset 245, limit 35)

Identify the duplicated `toLocaleDateString({ month: "short", year: ..., day: "numeric" })` config and the "is this year" branching.

- [ ] **Step 2: Create the helper**

Create `src/utils/formatPostDate.ts`:

```ts
export function formatPostDate(d: Date, locale?: string): string {
    const date = new Date(d);
    const isThisYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(locale, {
        month: "short",
        year: isThisYear ? undefined : "numeric",
        day: "numeric",
    });
}
```

**Note:** verify the `year: isThisYear ? undefined : "numeric"` pattern matches what the existing code does. If the current code does the inverse (always show year), preserve that.

- [ ] **Step 3: Update PostContainer.tsx**

Replace the inline formatting (lines 109-122) with a call to `formatPostDate(date)`.

- [ ] **Step 4: Update [userId]/[slug]/page.tsx**

Replace the inline formatting (lines 248-279) with a call to `formatPostDate(date)`.

- [ ] **Step 5: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/utils/formatPostDate.ts src/components/post/PostContainer.tsx "src/app/(base-layout)/[userId]/[slug]/page.tsx"`
Expected: same as before.

- [ ] **Step 6: Commit**

```bash
git add src/utils/formatPostDate.ts src/components/post/PostContainer.tsx "src/app/(base-layout)/[userId]/[slug]/page.tsx"
git commit -m "refactor(utils): extract formatPostDate helper"
```

---

## Task 10: B5 — inline Cloudinary draft fetch via uploadCloudinary

**Spec:** B5 in design doc.

**Files:**
- Modify: `src/app/api/post/draft/route.ts:121-150`

**Interfaces:** `uploadCloudinary` signature unchanged; the call site is the only change.

- [ ] **Step 1: Read both implementations**

Run: `Read src/app/api/post/draft/route.ts` (offset 115, limit 40)
Run: `Read src/utils/cloudinarySignature.ts` (or wherever `uploadCloudinary` lives)

Identify the manual signature+fetch block in the draft route and the helper to call instead.

- [ ] **Step 2: Replace the manual block with a call to the helper**

Replace lines 121-150 with:

```ts
const coverUrl = await uploadCloudinary({
    file: cover,
    folder: "zefer/post/draft",
    publicId: `${draft.id}_cover`,
});
```

Adjust the variable names to match the local file. The `cover` variable must already be a `File` / `Blob` / base64 string compatible with `uploadCloudinary`'s input.

- [ ] **Step 3: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/app/api/post/draft/route.ts`
Expected: same as before (or reduced if the manual block had errors).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/post/draft/route.ts
git commit -m "refactor(api): inline Cloudinary draft cover upload via uploadCloudinary"
```

---

## Task 11: B6 + B9 — split api/post route + unified ranking service + Prisma typing

**Spec:** B6 + B9 in design doc.

**Files:**
- Modify: `src/app/api/post/route.ts` (main refactor)
- Create: `src/app/api/post/_query.ts` (private helpers: `buildWhere`, `buildOrderBy`, `paginate`)
- Create: `src/utils/services/ranking.ts` (unified ranking service)
- Modify: `src/utils/actions/tag.ts` (delegate to the ranking service)
- Modify: `src/app/api/cron/route.ts` (delegate to the ranking service)
- Modify: `src/app/api/post/manage/series/post/route.ts` (use `Prisma.PostFindManyArgs`)

**Interfaces:**
```ts
// src/app/api/post/_query.ts
export function buildWhere(params: ListPostsParams): Prisma.PostWhereInput;
export function buildOrderBy(params: ListPostsParams): Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[];
export async function paginate(where: Prisma.PostWhereInput, orderBy: ..., page: number, perPage: number): Promise<PostListResult>;

// src/utils/services/ranking.ts
export type RankedTag = { tag: string; score: number };
export async function rankTagsForUser(userId: string, opts?: { limit?: number }): Promise<RankedTag[]>;
```

- [ ] **Step 1: Read all four files in full**

Run: `Read src/app/api/post/route.ts`
Run: `Read src/utils/actions/tag.ts`
Run: `Read src/app/api/cron/route.ts`
Run: `Read src/app/api/post/manage/series/post/route.ts`

Identify the three ranking implementations (route.ts relevance block, tag.ts `getTagRankings`, cron `tagRanks()`). Note the divergent inputs/outputs and pick the union shape.

- [ ] **Step 2: Create `src/utils/services/ranking.ts`**

Create the unified ranking service. The body must include:
- `rankTagsForUser(userId, opts?)` — the function the route's relevance branch calls
- Internal: `getUserInterests(userId)`, `getUserReadingHistory(userId)`, `getUserReactions(userId)`, `getTopPosts(opts)` — each function reads from the right Prisma tables
- The score-combination algorithm: merge interest tags, recent-read tags, reacted-on tags; fall back to top-posts by recency; dedupe; sort by composite score

**Note:** this is the highest-risk task in the plan. The worker must read each existing implementation carefully and preserve the union of their semantics. If the three disagree on a detail (e.g., one uses `tagsRanking` table, one reads `posts.tags` directly), the unified function must support both via a feature flag or a single canonical source — pick one and document the decision in the function's docstring.

- [ ] **Step 3: Create `src/app/api/post/_query.ts`**

Extract `buildWhere`, `buildOrderBy`, and `paginate` into this private helper file. Each takes a typed `ListPostsParams` and returns the right Prisma type. Use `Prisma.PostFindManyArgs['where']` etc. for proper typing.

- [ ] **Step 4: Refactor `src/app/api/post/route.ts` to use both helpers**

Replace the inline `prismaQuery` mutation blocks (lines 25-39 + the 170-line relevance block at 124-291) with calls to the helpers. The relevance branch becomes a single call to `rankTagsForUser(userId)` followed by a tag-filtered query.

- [ ] **Step 5: Refactor `src/utils/actions/tag.ts:getTagRankings`**

Replace the body with a delegation to `rankTagsForUser` from the new service. Keep the named export and the same return type for backward compat.

- [ ] **Step 6: Refactor `src/app/api/cron/route.ts:tagRanks()`**

Same as step 5: delegate to the unified service.

- [ ] **Step 7: Refactor `src/app/api/post/manage/series/post/route.ts`**

Replace the hand-rolled `PrismaQuery` interface (lines 5-13) with `Prisma.PostFindManyArgs`. Use the new helpers from `_query.ts` if this route also does where/orderBy/paginate logic.

- [ ] **Step 8: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0. If TS errors surface (likely — this is the B9 risk), fix them inline in the same commit. Do not introduce `as any` casts; use proper Prisma types.

Run: `npx eslint src/app/api/post/ src/utils/services/ src/utils/actions/tag.ts src/app/api/cron/`
Expected: same as before.

- [ ] **Step 9: Commit**

```bash
git add -A src/app/api/post/ src/utils/services/ src/utils/actions/tag.ts src/app/api/cron/
git commit -m "refactor(api/post): split route into _query helpers, unify ranking service, type with Prisma.PostFindManyArgs"
```

---

## Task 12: B7 — timeDiffCalc → Intl.RelativeTimeFormat

**Spec:** B7 in design doc. **User-visible strings change** — design sign-off recorded.

**Files:**
- Modify: `src/utils/timeDiffCalc.ts`

**Interfaces:** function signature unchanged (same name, same param shape) so call sites don't change.

- [ ] **Step 1: Read the current implementation**

Run: `Read src/utils/timeDiffCalc.ts`

Note the current cascading logic (months → days → hours → minutes → seconds) and the singular/plural rules.

- [ ] **Step 2: Find all importers**

Run: `Grep "timeDiffCalc" --pattern "import|from|require"`

- [ ] **Step 3: Rewrite using Intl.RelativeTimeFormat**

Replace the file body with:

```ts
export function timeDiffCalc(input: Date | string | number, locale?: string): string {
    const target = new Date(input).getTime();
    const now = Date.now();
    const diffSeconds = Math.round((target - now) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
        { unit: "year", seconds: 31536000 },
        { unit: "month", seconds: 2592000 },
        { unit: "week", seconds: 604800 },
        { unit: "day", seconds: 86400 },
        { unit: "hour", seconds: 3600 },
        { unit: "minute", seconds: 60 },
        { unit: "second", seconds: 1 },
    ];

    for (const { unit, seconds } of units) {
        if (Math.abs(diffSeconds) >= seconds || unit === "second") {
            return rtf.format(Math.round(diffSeconds / seconds), unit);
        }
    }
    return rtf.format(0, "second");
}
```

**Note:** adapt the parameter list to match the existing function signature. The above is a typical shape; preserve the existing export name and any existing options.

- [ ] **Step 4: Verify tsc + lint + manual spot-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/utils/timeDiffCalc.ts`
Expected: same as before.

Manual spot-check: import the function in a scratch script and call it with a few sample dates; confirm the output reads "last month" / "in 3 days" / "yesterday" — these are the user-visible changes.

- [ ] **Step 5: Commit**

```bash
git add src/utils/timeDiffCalc.ts
git commit -m "refactor(utils): timeDiffCalc uses Intl.RelativeTimeFormat"
```

---

## Task 13: B8 — randomNumberGen4Digit / generateRandomCode → crypto.randomInt

**Spec:** B8 in design doc.

**Files:**
- Delete: `src/utils/randomNumberGen4Digit.ts`
- Modify: `src/app/api/post/route.ts:362-373` (inline `crypto.randomInt`)
- Modify: every importer of the deleted helper (search via `Grep`)

**Interfaces:** none new.

- [ ] **Step 1: Find all importers**

Run: `Grep "randomNumberGen4Digit" --pattern "import|from|require"`

Note every file. Each call site changes from `randomNumberGen4Digit()` to `crypto.randomInt(1000, 10000)` (1 line).

- [ ] **Step 2: Replace call sites and delete the helper**

For each importer, replace the import + call. Add `import { randomInt } from "crypto";` at the top of the file if not already imported.

Then:
```bash
git rm src/utils/randomNumberGen4Digit.ts
```

- [ ] **Step 3: Replace `generateRandomCode` in api/post/route.ts**

Replace lines 362-373 with:

```ts
function generateRandomCode(): string {
    return randomBytes(2).toString("base64url").slice(0, 4);
}
```

Add `import { randomBytes } from "crypto";` to the top if not present.

- [ ] **Step 4: Verify tsc + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint src/app/api/post/route.ts`
Expected: same as before.

- [ ] **Step 5: Commit**

```bash
git add -A src/utils/randomNumberGen4Digit.ts src/app/api/post/route.ts <every other modified file>
git commit -m "chore(utils): replace randomNumberGen helpers with crypto.randomInt/randomBytes"
```

---

## Task 14: D + C3 — extract Tiptap subcomponents + clear eslint-disable

**Spec:** D + C3 in design doc.

**Files:**
- Modify: `src/components/wysiwyg/Tiptap.tsx` (decompose + fix remaining strict errors)
- Create: `src/components/wysiwyg/hooks/useAutosave.ts`
- Create: `src/components/wysiwyg/ImageUploadForm.tsx`
- Create: `src/components/wysiwyg/TagInput.tsx`
- Create: `src/components/wysiwyg/PostStatusBanner.tsx`
- Modify: `next-auth.d.ts` (remove stale `// eslint-disable-next-line` comment)
- Modify: `package.json` (add test deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`)
- Create: `vitest.config.ts`

**Interfaces:**
- `useAutosave` — hook returns `{ save: (content: string) => void; status: "idle" | "saving" | "saved" | "error" }`
- `ImageUploadForm` props: `{ onUpload: (url: string) => void }`
- `TagInput` props: `{ value: string[]; onChange: (tags: string[]) => void; validate?: (tag: string) => Promise<boolean> }`
- `PostStatusBanner` props: `{ postError: StatusResponse | null }`

- [ ] **Step 1: Add test deps**

Run:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Verify `package.json` devDependencies now includes all four.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
    },
});
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Run `npx eslint src/components/wysiwyg/Tiptap.tsx` and capture all errors**

Run: `npx eslint src/components/wysiwyg/Tiptap.tsx 2>&1 | tee /tmp/tiptap-lint.txt`

The output lists all 20+ errors. Group them by rule. Plan the decomposition so each extracted subcomponent takes its share of errors with it.

- [ ] **Step 4: Extract `useAutosave` hook**

Identify the autosave logic in Tiptap.tsx (search for `useEffect` + `setTimeout` / `setInterval` related to saving the editor content).

Create `src/components/wysiwyg/hooks/useAutosave.ts` with the hook body. Replace the inline logic in Tiptap.tsx with `const { save, status } = useAutosave({ content, onSave: ... });`.

Re-run `npx eslint src/components/wysiwyg/Tiptap.tsx` — expect the error count to drop.

- [ ] **Step 5: Extract `ImageUploadForm`**

Identify the image-upload form JSX in Tiptap.tsx (search for the upload form: file input + Cloudinary URL handling).

Create `src/components/wysiwyg/ImageUploadForm.tsx` with the form. Pass `onUpload: (url) => editor.chain().focus().setImage({ src: url }).run()` from Tiptap.

Re-run `npx eslint src/components/wysiwyg/Tiptap.tsx`.

- [ ] **Step 6: Extract `TagInput`**

Identify the tag input + validate logic in Tiptap.tsx.

Create `src/components/wysiwyg/TagInput.tsx`. The `validateTag` call stays in the parent or moves into the hook; pick whichever has fewer closure bindings.

Re-run `npx eslint src/components/wysiwyg/Tiptap.tsx`.

- [ ] **Step 7: Extract `PostStatusBanner`**

Identify the post-status banner JSX (the `StautsNotif`/now-`StatusNotif` rendering block at the top of the editor).

Create `src/components/wysiwyg/PostStatusBanner.tsx`. Replace the inline JSX with `<PostStatusBanner postError={postError} />`.

Re-run `npx eslint src/components/wysiwyg/Tiptap.tsx`. **Expected: 0 errors or near-0.**

- [ ] **Step 8: Fix any remaining strict-rule errors in Tiptap.tsx**

For each remaining error, apply the minimal fix:
- `react-hooks/rules-of-hooks` — restructure the component so hooks are called in the same order every render
- `react/no-unstable-nested-components` — extract any inline function component into a named component or `useCallback`/`useMemo`
- Other React 19 strict rules — read the rule's doc and apply the suggested fix

Re-run `npx eslint src/components/wysiwyg/Tiptap.tsx` — **expected: 0 errors.**

- [ ] **Step 9: Remove the stale eslint-disable comment in next-auth.d.ts (C3)**

In `next-auth.d.ts` line 4, delete:
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```

Re-run `npx eslint next-auth.d.ts` — **expected: 0 errors.**

- [ ] **Step 10: Add a render test for each extracted subcomponent**

For each of the 4 new files, add a smoke test in `src/components/wysiwyg/__tests__/`:
- `useAutosave.test.ts` — calls the hook with a mock `onSave`, verifies it's called after the debounce
- `ImageUploadForm.test.tsx` — renders, simulates file upload, verifies `onUpload` called
- `TagInput.test.tsx` — renders, types a tag, verifies `onChange` called with the new array
- `PostStatusBanner.test.tsx` — renders with a mock error, verifies the message shows

Run: `npx vitest run`
Expected: all 4 tests PASS.

- [ ] **Step 11: Final per-project lint check**

Run: `npx eslint .`
Expected: **0 errors** (down from 22).

If errors remain, fix them in this same task before committing. Common leftover: the new test files might trigger their own errors (e.g., `no-unused-vars` on test imports). Add an ESLint override for `*.test.{ts,tsx}` in `eslint.config.mjs` if needed:

```js
{
    files: ["**/*.test.{ts,tsx}"],
    rules: { "no-unused-vars": "off" },
}
```

- [ ] **Step 12: Commit**

```bash
git add -A src/components/wysiwyg/ next-auth.d.ts package.json package-lock.json vitest.config.ts vitest.setup.ts eslint.config.mjs
git commit -m "chore(lint): decompose Tiptap.tsx, clear 22 pre-existing lint errors, add vitest"
```

---

## Task 15: Final pre-merge verification

**Files:** none modified.

- [ ] **Step 1: Run the combined lint gate**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: exit 0 (or any pre-existing warnings from the modernization work — but no new errors).

- [ ] **Step 3: Run e2e tests (if env available)**

Run: `npx playwright test`
Expected: PASS. If env not set up, document the skip in the PR body.

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin chore/resolve-concerns
```

Open a PR against `development` with:
- Title: `chore: resolve CONCERNS.md (A bugs + B refactors + D lint + E5 doc)`
- Body: the 15-commit summary from the spec's "Commit shape" section, plus the `npm run lint` exit-0 confirmation, plus a note that E5 (AGENTS.md concern) is doc-only and E1 (AGENTS.md file) is a future task.

---

## Spec Coverage

Self-review against `docs/superpowers/specs/2026-08-05-resolve-concerns-design.md`:

| Spec section | Task |
|--------------|------|
| A1 PostSlugWatcher timers | T2 |
| A2 token.sub! | T3 |
| A3 "Personal Webite" typo | T4 |
| A4 StautsNotif rename | T5 |
| A5 gemini-pro deprecation | T6 |
| B1 reaction button merge | T7 |
| B2 useInfiniteList hook | T8 |
| B3 reaction action helpers | T7 (paired) |
| B4 formatPostDate | T9 |
| B5 Cloudinary draft inline | T10 |
| B6 api/post relevance block | T11 |
| B7 timeDiffCalc → Intl.RelativeTimeFormat | T12 |
| B8 randomNumberGen → crypto | T13 |
| B9 PrismaQuery removal | T11 (paired) |
| B10 toExclude keep | n/a (no change) |
| C1 lib/utils done | n/a (already done) |
| C2 constants.js | n/a (modernization spec owns) |
| C3 next-auth.d.ts comment | T14 step 9 |
| D Tiptap.tsx lint | T14 |
| E5 new concern | T1 |
| Verification gate | T15 + per-task steps |
| Risk register | mitigated in T11, T12, T14 |

All spec items covered. No placeholders. Type consistency verified: `rankTagsForUser` and `RankedTag` defined in T11 step 2, used in T11 steps 4-6. `ReactionButton` props defined in T7 step 3, used in T7 step 5. Hook interface in T8 step 2 used in T8 steps 3-4.
