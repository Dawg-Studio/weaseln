# weaseln Creative Profile Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, responsive profile customization builder backed by one `UserProfileCustomization` row per user, while migrating away from `User.profileTheme` and `User.backgroundImage`.

**Architecture:** Keep identity/content fields on `User` and move presentation settings to a one-to-one customization model. Validate requests at the API boundary, store section layout as constrained JSON, and map saved values to known CSS variables/classes in the public profile renderer. Reuse Cloudinary for background images and save changes live.

**Tech Stack:** Next.js 16.3 App Router, React 19, Prisma 6.8.2/PostgreSQL, Auth.js v5, Tailwind v4/DaisyUI, React Hook Form, Vitest, Playwright.

## Global Constraints

- Use `await auth()` and guard every authenticated page/handler on `session?.user`.
- Never use non-null assertions on session fields.
- Keep the profile customization responsive with one configuration; do not add mobile-specific layouts.
- Never accept or render arbitrary CSS, HTML, or JavaScript.
- Reuse the existing Cloudinary upload flow; store only the resulting URL.
- Throw or return explicit failures for invalid data; do not silently fabricate fallback values at trust boundaries.
- Preserve accessible names, contrast, keyboard operation, and meaningful image alt text.
- Before completion, run both `npx eslint .` and `npx tsc --noEmit`.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Add the one-to-one customization relation/model; remove two legacy `User` fields. |
| The migration directory created by `npx prisma migrate dev --name profile_customization --create-only` | Create the table, backfill every existing user, migrate legacy values, and remove old columns. |
| `src/modules/profile-customization/types.ts` | Shared section/layout/style types and default configuration. |
| `src/modules/profile-customization/validation.ts` | Server-side validation and normalization of API input. |
| `src/app/api/user/profile-customization/route.ts` | Authenticated GET/PATCH/reset endpoint for the current user. |
| `src/app/(base-layout)/settings/profile/customization/page.tsx` | Authenticated customization settings page. |
| `src/app/(base-layout)/settings/profile/customization/_components/ProfileCustomization.tsx` | Client editor controls and live-save interactions. |
| `src/app/(base-layout)/settings/profile/page.tsx` | Link to the customization settings page. |
| `src/app/(base-layout)/[userId]/page.tsx` | Load customization with public profile data. |
| `src/components/user/UserOrgProfile.tsx` | Render user customization and ordered/hidden profile sections. |
| `docs/QA.md` | Add the authenticated editor and public-profile smoke flow. |
| `src/modules/profile-customization/validation.test.ts` | Focused validation/default tests. |
| `src/app/api/user/profile-customization/route.test.ts` | Endpoint auth and persistence tests, following the repository's available Vitest setup. |

---

### Task 1: Add shared customization types and defaults

**Files:**
- Create: `src/modules/profile-customization/types.ts`
- Create: `src/modules/profile-customization/validation.ts`
- Test: `src/modules/profile-customization/validation.test.ts`

**Interfaces:** Produces `ProfileSection`, `ProfileLayout`, `ProfileCustomization`, `DEFAULT_PROFILE_LAYOUT`, `DEFAULT_PROFILE_CUSTOMIZATION`, and `validateProfileCustomizationInput` for Tasks 2–5.

- [ ] **Step 1: Write failing tests for defaults and validation**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_LAYOUT, validateProfileCustomizationInput } from "./validation";

describe("profile customization validation", () => {
  it("uses the approved default section order", () => {
    expect(DEFAULT_PROFILE_LAYOUT.sectionOrder).toEqual([
      "hero", "stats", "about", "socials", "featuredPost",
      "interests", "organizations", "posts",
    ]);
  });

  it("rejects unknown sections and duplicate sections", () => {
    expect(() => validateProfileCustomizationInput({
      layout: { variant: "wide", sectionOrder: ["hero", "hero"], hiddenSections: ["unknown"] },
    })).toThrow();
  });

  it("rejects unsafe background URLs and out-of-range opacity", () => {
    expect(() => validateProfileCustomizationInput({
      backgroundImage: "javascript:alert(1)", cardOpacity: 101,
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/modules/profile-customization/validation.test.ts`

Expected: FAIL because the shared types and validator do not exist.

- [ ] **Step 3: Implement the minimum shared contract**

Define the section union (`hero`, `stats`, `about`, `socials`, `featuredPost`, `interests`, `organizations`, `posts`) and layout variants (`standard`, `sidebar`, `wide`). Define style-token unions for preset, background size/position, radius, shadow, border, font, heading size, alignment, and spacing. Validate bounded hex/rgb/hsl colors, only Cloudinary or `/covers/` background URLs, unique supported sections, and opacity in `0..100`. Export defaults with preset `minimal`, standard order, no hidden sections, and safe visual defaults. Invalid input throws a descriptive error.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run src/modules/profile-customization/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile-customization
git commit -m "feat(profile): add customization types and validation"
```

### Task 2: Add the Prisma model and data migration

**Files:**
- Modify: `prisma/schema.prisma:46-89`
- Create: the migration directory produced by `npx prisma migrate dev --name profile_customization --create-only`

**Interfaces:** Consumes Task 1's default layout JSON shape; produces `prisma.userProfileCustomization` and generated Prisma types.

- [ ] **Step 1: Add the relation/model and remove legacy columns**

Add `profileCustomization UserProfileCustomization?` to `User`. Add the approved one-to-one model under `@@schema("users")`, including preset, layout, background, surface, color, typography, timestamps, and cascading user relation. Remove `profileTheme` and `backgroundImage` from `User`.

- [ ] **Step 2: Generate the migration without applying unrelated changes**

Run: `npx prisma migrate dev --name profile_customization --create-only`

Expected: one new migration directory containing only this model/relation change. Do not stage unrelated working-tree edits.

- [ ] **Step 3: Add explicit backfill SQL**

In the generated migration, before dropping the legacy columns, insert one row per existing `users.User`. Use a stable generated id, preset `minimal` unless `profileTheme` is a supported preset, the standard layout JSON, and the existing `backgroundImage` value. Keep the SQL compatible with the repository's quoted `users` schema/table names. Make the insert idempotent with `ON CONFLICT ("userId") DO NOTHING`.

- [ ] **Step 4: Apply and verify the schema**

Run: `npx prisma migrate dev` and `npx prisma generate`.

Expected: migration succeeds, generated client exposes `userProfileCustomization`, and existing users each have one customization row.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(profile): add customization persistence"
```

### Task 3: Add the authenticated customization API

**Files:**
- Create: `src/app/api/user/profile-customization/route.ts`
- Test: `src/app/api/user/profile-customization/route.test.ts`

**Interfaces:** Consumes `validateProfileCustomizationInput` and Prisma model; produces `GET`, `PATCH`, and `DELETE` handlers for the current session user.

- [ ] **Step 1: Write failing auth and persistence tests**

Test that an anonymous `PATCH` returns 307 or 401 according to the repository route convention, an authenticated patch updates only the session user's row, invalid fields return 400, `GET` returns defaults for a missing row, and `DELETE` resets the row to defaults rather than deleting the user.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/app/api/user/profile-customization/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route**

Each handler calls `await auth()` and explicitly guards `session?.user`; never pass an optional session id to Prisma. `GET` loads the current user's row and returns the default object when absent. `PATCH` parses JSON, validates the complete or partial customization payload, merges partial fields with the existing/default object, and uses `upsert` with `userId: session.user.id`. `DELETE` replaces the row with the default configuration. Return structured 400/401/500 JSON errors and log unexpected database failures.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run src/app/api/user/profile-customization/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/user/profile-customization
git commit -m "feat(profile): add customization API"
```

### Task 4: Build the settings editor and settings navigation

**Files:**
- Create: `src/app/(base-layout)/settings/profile/customization/page.tsx`
- Create: `src/app/(base-layout)/settings/profile/customization/_components/ProfileCustomization.tsx`
- Modify: `src/app/(base-layout)/settings/profile/page.tsx`

**Interfaces:** Consumes the Task 3 API and shared types; produces an authenticated live-save editor at `/settings/profile/customization`.

- [ ] **Step 1: Add the authenticated page loader**

Guard with `await auth()` and redirect anonymous users to `/api/auth/signin`. Fetch the current user's customization server-side and pass it to the client editor. Render defaults when the API/database has no row.

- [ ] **Step 2: Build labeled controls for every approved group**

Implement preset/layout selects, section visibility and up/down ordering, native color inputs, background image upload/remove/position/size/overlay controls, card opacity/radius/shadow/border, typography, spacing, and reset. Use known token options only. Every input and button gets a visible or explicit accessible label; ordering buttons expose whether movement is possible.

- [ ] **Step 3: Implement live save without a new state library**

Keep one local customization object, update controls immutably, debounce PATCH requests to avoid a request per keystroke, show saving/saved/error status, and refresh the router after a successful save when server-rendered state is affected. Use the existing toast dependency only for clear success/failure messages.

- [ ] **Step 4: Reuse Cloudinary for backgrounds**

Use the existing `/api/user/cloudinary` upload contract, show the selected image preview, send only the returned URL to the customization endpoint, and provide a remove action that sends `null`.

- [ ] **Step 5: Link from existing profile settings and verify manually**

Add a clear “Customize profile” link to the existing profile settings UI. Run the app, open `/settings/profile/customization`, verify anonymous redirect, keyboard labels, live save, reset, and background upload behavior.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(base-layout)/settings/profile"
git commit -m "feat(profile): add customization editor"
```

### Task 5: Render customization on public profiles

**Files:**
- Modify: `src/app/(base-layout)/[userId]/page.tsx:16-68`
- Modify: `src/components/user/UserOrgProfile.tsx:20-239`
- Modify: `src/modules/profile-customization/validation.ts` if a shared render-normalization helper is needed.

**Interfaces:** Consumes the Prisma customization row and validated shared types; produces a public profile that applies colors, backgrounds, surfaces, typography, layout variants, section visibility, and order.

- [ ] **Step 1: Add customization to profile queries**

Include `profileCustomization` in both `generateMetadata`-independent profile data paths where the public profile component needs it. Keep metadata behavior unchanged and avoid loading customization in unrelated organization profile queries.

- [ ] **Step 2: Add safe render normalization**

Normalize missing rows to defaults and validate persisted JSON before use. For malformed data, log the invalid record and use the complete safe default rather than passing arbitrary values into JSX/styles.

- [ ] **Step 3: Apply known visual tokens**

Build CSS variables only from validated values, including page background, gradient, text, muted text, accent, card color/opacity, background image, position, and size. Map radius/shadow/border/font/heading/alignment/spacing options to fixed classes. Do not use arbitrary class names or raw user strings in a class attribute.

- [ ] **Step 4: Extract the current profile markup into ordered sections**

Preserve current hero, stats, about, social, and posts behavior. Add featured post, interests, and organizations using existing data where available; if content is absent, render no empty section. Filter hidden sections, preserve only supported sections, and render the result in `sectionOrder`. Keep follow controls and organization rendering behavior intact.

- [ ] **Step 5: Verify public behavior**

Check a default profile, a fully customized profile, reordered sections, hidden sections, a background image, and a malformed database value. Verify mobile width, contrast, alt text, link accessibility, and no arbitrary CSS is emitted.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(base-layout)/[userId]/page.tsx" src/components/user/UserOrgProfile.tsx src/modules/profile-customization
git commit -m "feat(profile): render user customizations"
```

### Task 6: Add QA coverage and run the full checks

**Files:**
- Modify: `docs/QA.md`
- Modify: `tests/profile-customization.spec.ts`

**Interfaces:** Consumes the finished editor/API/renderer; produces a repeatable authenticated smoke flow.

- [ ] **Step 1: Document the QA flow**

Add steps using the seeded Alice account: open `/settings/profile/customization`, change preset/colors/background/layout, verify live save, open `/alice` in a separate user context, verify the public result, reset to defaults, and verify the default rendering. Include anonymous redirect behavior.

- [ ] **Step 2: Run focused tests and the existing QA suite**

Run `npx vitest run` and `npx playwright test`. Expected: focused validation/API tests and the existing `tests/search.spec.ts`, `tests/feed.spec.ts`, and new profile customization test pass.

- [ ] **Step 3: Run required static checks**

Run exactly:

```bash
npx eslint .
npx tsc --noEmit
```

Expected: both commands exit 0. Fix only errors caused by this feature; do not rewrite unrelated pre-existing files.

- [ ] **Step 4: Review the final diff and commit QA docs**

Run `git status --short`, `git diff --check`, and `git diff --stat`. Confirm no unrelated deletions or edits are staged, then commit:

```bash
git add docs/QA.md
git commit -m "test(profile): cover customization flow"
```

## Self-review checklist

- Spec coverage: schema migration, Cloudinary reuse, live API saves, curated controls, section ordering/visibility, responsive rendering, validation, reset, QA, and required lint/type checks each have a task.
- Placeholder scan: no TBD/TODO or unresolved implementation placeholder remains; Prisma creates the migration directory through the exact command in Task 2.
- Type consistency: `ProfileSection`, `ProfileLayout`, `ProfileCustomization`, defaults, and validator are defined in Task 1 and consumed by all later tasks.
- Scope: no arbitrary builder, saved theme marketplace, mobile-specific configuration, or new storage system is introduced.
