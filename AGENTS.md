# AGENTS.md — Project rules

These rules come from the modernization spec (`docs/superpowers/specs/2026-08-04-zefer-modernization-design.md`), the concerns doc (`docs/CONCERNS.md`), and lessons captured during the browser QA pass. Future agents and contributors must follow them.

## Pre-completion checklist

Before declaring work done, run **both** of the following and confirm exit 0:

- `npx eslint .` — catches React 19 strict-rule violations, unused vars, accessibility regressions, etc.
- `npx tsc --noEmit` — catches type errors that `eslint` does not see.

Running only one is **not** sufficient. The 26 pre-existing lint errors in `Tiptap.tsx` (see `docs/CONCERNS.md` Group D) accumulated precisely because prior PRs ran only `tsc` and skipped eslint. Do not repeat that mistake.

## Authentication

- **Auth library:** Auth.js v5 (`next-auth@5.0.0-beta.32`). Use `await auth()` from `@/auth`, not `getServerSession()`.
- **Pages and route handlers must guard on `session?.user`** before using `session.user.id`. The explicit pattern is:
  ```ts
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  ```
  Each route that needs an authenticated user is responsible for this guard. Do not rely on `proxy.ts`/middleware alone — it is the second line of defense, not the only one.
- **No non-null assertions on session fields.** Do not write `session!.user.id` or `token.sub!`. If a required field is missing, throw or return an explicit failure so the bug is loud, not silent. See `docs/CONCERNS.md` A2.
- **Per-user browser sessions must use isolated contexts.** NextAuth sessions live in cookies; logging in as a second user in the same browser context overwrites the first. Use `browser.newContext()` per user, or `context.clearCookies()` between switches.

## Next.js

- **Next.js 16.3.0**, App Router only. Async `params`, async `cookies()`, async `headers()`, async `draftMode()` are required. The codemod `npx @next/codemod@latest upgrade latest` handles the mechanical sweep; verify by hand for `page.tsx`, `generateMetadata`, and route handlers.
- **`proxy.ts` not `middleware.ts`.** Next 16 renamed the middleware file. If a `middleware.ts` appears, delete it and move the logic to `proxy.ts` using `auth(...)` from `@/auth`.
- **Turbopack is the default.** Do not add `--turbopack` to scripts; remove it if you see it. The `turbopack` block in `next.config.mjs` uses defaults; do not add custom rules.

## Database / Prisma

- **Prisma 6.8.2.** Generate with `npx prisma generate`, push schema with `npx prisma db push`, seed with `npm run db:seed`. `predev`, `db:setup`, and `build` scripts already wire these.
- **`socials Json[]` may be `null` in the database** even when the seed sets `[]`. Always default to `[]` before spreading on the client: `const socialData = [...(socials ?? [])] as FormSocials[]`. Spreading `null` throws `socials is not iterable` and crashes the page with HTTP 500 — see `docs/CONCERNS.md` A3 and the QA history.
- **Implicit M2M `following.connect(...)` is unreliable for seeding.** Prisma silently drops some pairs. Write follow rows directly via `prisma.$executeRaw` into `users._UserFollows` with `ON CONFLICT ("A", "B") DO NOTHING`. See `prisma/seed.ts` `SEEDED_FOLLOWS`.
- **Posts: `_count.post` should count drafts too** when shown on profile pages, not only published. Use `{ _count: { select: { post: true } } }` and add `_count.following` for the following count. See `src/app/(base-layout)/[userId]/page.tsx`.

## Cloudinary / cover images

- The cover image is required for publishing. The composer uploads the picked file to Cloudinary and stores the resulting URL on the `Post.coverImage` field.
- **QA bypass:** when `NEXT_PUBLIC_QA_NO_COVER=1`, the editor seeds `/covers/cover-1.svg` as the cover, sends it as a string in the FormData, and `/api/post` (and `/api/post/draft`) detect the URL prefix and store it directly without a Cloudinary round trip. This lets a QA run exercise the full publish path without external credentials.
- The detection heuristic in both routes is:
  ```ts
  const coverIsUrl =
      typeof coverField === "string" &&
      (coverField.startsWith("/covers/") || coverField.startsWith("http"));
  ```

## UI / accessibility

- Every interactive control must have an accessible name. Anonymous-view gotchas to watch:
  - The drawer-toggle checkbox in `src/components/ui/Navigation.tsx` (`<input id="sidemenu-drawer" type="checkbox" />`) needs `aria-label="Open sidebar"`.
  - The submit button in `src/components/ui/SearchBar.tsx` (`<button><FontAwesomeIcon icon={faSearch} /></button>`) needs `aria-label="Search"` and `type="button"`.
- The Tiptap post composer has three editors stacked in DOM order: title → description → body. Give each an explicit `aria-label` (`"Post title"`, `"Post description"`, `"Post body"`) so automated agents and screen-reader users land in the right region when clicking the prose area.
- The org page must list members with role badges (`OWNER`, `ADMIN`, `MEMBER`). Build the array server-side by joining `owner`, `admins`, and `members` and deduplicating the owner from admin/member lists. See `src/app/(base-layout)/organization/[orgId]/page.tsx`.

## QA workflow

- The QA doc (`docs/QA.md`) is the source of truth for what "passing" looks like. Update it whenever you add or change a user-facing flow.
- The dev server must be started with `ENABLE_DEV_LOGIN=true` for automated QA. Without it, `/api/dev-login` returns 404 and the test agent cannot authenticate.
- One browser context per seeded user (Alice, Bob, Carol). The seeded emails and usernames live in `prisma/seed.ts` and are referenced in `docs/QA.md` §1.
- Anonymous routes that need a session must return **HTTP 307 → `/api/auth/signin`**, not 200 with the page rendered. If a route returns 500 for anonymous, you almost certainly forgot the auth gate (see `src/app/new/page.tsx` history).
- The standalone Socket.IO server on `ws://localhost:5000` is **not** required for the static-render checks in `docs/QA.md`. Browser console errors about `ws://localhost:5000` are expected if the Socket.IO server isn't running and do not block a "passing" run.

## Cross-references

- `docs/superpowers/specs/2026-08-04-zefer-modernization-design.md` — target stack and the phased plan.
- `docs/superpowers/plans/2026-08-04-zefer-modernization.md` — implementation plan.
- `docs/CONCERNS.md` — known correctness/refactor issues, including the `socials` crash (A3), the `gemini-pro` shutdown (A5), and the load-bearing typo `StautsNotif` (A4).
- `docs/QA.md` — seeded fixtures and per-user browser smoke checks, including post creation (§5).
- `README.md` — local dev setup, dev-login flag, and seeded credentials.