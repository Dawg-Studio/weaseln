# ZeFer Modernization Design

**Date:** 2026-08-04
**Branch:** `chore/upgrade-next16-auth5` (clean working tree)
**Author:** Superpowers brainstorming → writing-plans flow

## Goal

Bring ZeFer from a half-broken Next.js 15 + next-auth v4 codebase to a fully working **Next.js 16 + Auth.js v5 + Tailwind 4 + daisyUI 5** stack on a single, reviewable branch.

## Decisions locked with user

| Decision | Choice |
|---|---|
| Scope | Full modern stack |
| Cache Components (PPR) | Off for now — no static-friendly routes to optimize, every page is session-bound |
| Execution model | Single plan, phased tasks (this doc) |
| Auth library | `next-auth@5.0.0-beta.32` (v5 is still beta but is the documented path) |
| next-pwa | Keep (risk flagged) |
| next-sitemap | Drop in favor of built-in `app/sitemap.ts` + `app/robots.ts` |
| ESLint | Migrate `.eslintrc.json` → `eslint.config.mjs` flat config |

## Target stack (versions verified `npm view` on 2026-08-04)

| Package | From | To |
|---|---|---|
| `next` | `15.5.15` | `^16.3.0` |
| `react` / `react-dom` | `19.1.0` | `^19.1.0` (no change) |
| `next-auth` | `^4.24.11` | `5.0.0-beta.32` |
| `@auth/prisma-adapter` | `^2.11.1` | `^2.11.3` |
| `tailwindcss` | `3.4.16` | `^4.3.3` |
| `@tailwindcss/postcss` | — | `^4.3.3` (new — replaces `tailwindcss` postcss plugin) |
| `daisyui` | `^4.12.14` | `^5.7.15` |
| `@tailwindcss/typography` | `^0.5.15` | `^0.5.16` (or drop if daisyUI 5 covers prose) |
| `tailwind-scrollbar` | `^3.1.0` | keep or drop (Tailwind 4 ships scroll utilities) |
| `nextjs-toploader` | `^3.8.16` | `^3.9.17` (3.x line stable; v4 not released) |
| `@ducanh2912/next-pwa` | `^10.2.9` | `^10.2.9` (no newer release; risk flagged) |
| `next-sitemap` | `^4.2.3` | **removed** |
| `@sentry/nextjs` | `^10.43.0` | `^10.69.0` (re-run wizard) |
| `eslint` | `^9.28.0` | `^10.8.0` |
| `eslint-config-next` | `15.3.3` | `^16.3.0` |
| `@eslint/eslintrc` | — | `^3.3.6` (for flat config compat shim) |
| `typescript` | `5.8.3` | `5.8.3` (no change) |

## Current state (broken)

Working tree clean, but the codebase will not build. Findings:

1. **`src/utils/authConfig.ts` is missing.** 38 source files import it; `tsc` reports `TS2307 Cannot find module '@/utils/authConfig'`. The file is referenced in `tsconfig.json` include globs but does not exist on disk.
2. **`getServerSession` is imported from `next-auth`** (v5 import path), but `next-auth` is still at v4.24.11, which exports `getServerSession` from `next-auth/next`. `tsc` reports `TS2614`.
3. **`next.config.mjs` mixes PWA + Sentry wrappers**. `withPWA` then `withSentryConfig(nextConfig, withPWA, ...)`. Order matters under Turbopack; this needs re-ordering for Next 16.
4. **No `src/middleware.ts`** (confirmed). Auth route protection currently relies on per-page `getServerSession` calls rather than middleware. Next 16 renames `middleware.ts` → `proxy.ts`; we want a real proxy with v5's `auth()` wrapper.
5. **`.eslintrc.json` (JSON)** must migrate to `eslint.config.mjs` (flat config) per Next 16 + ESLint 10.
6. **Tailwind config is JS-via-`require`**: `tailwind.config.ts` uses `require("daisyui")`. Tailwind 4 drops JS config in favor of CSS-first `@import "tailwindcss"` + `@plugin` directives.
7. **`tsconfig.json` includes paths for `.js` files** (`src/app/api/auth/[...nextauth].js`, `src/middleware.js`, `src/utils/socketURL.js`, `src/constants.js`) — Next 16 still supports this but `socketURL.mjs` exists at the same logical path with a different extension. Resolve this collision.
8. **`nextjs-toploader` 3.8.16** has known issues with Next 16 Suspense boundaries — bump to 3.9.17.

## Architecture: target state

```
src/
├── auth.ts                 # NEW — Auth.js v5 entry, exports { handlers, auth, signIn, signOut }
├── proxy.ts                # NEW — Next 16 proxy (formerly middleware), wraps auth() for route protection
├── instrumentation.ts      # unchanged
├── app/
│   ├── api/auth/[...nextauth]/route.ts   # SIMPLIFIED to `export const { GET, POST } = handlers`
│   ├── sitemap.ts                        # NEW — replaces next-sitemap
│   ├── robots.ts                         # NEW — replaces next-sitemap robots.txt
│   ├── (base-layout)/.../page.tsx        # async params + auth() pattern
│   └── ...
├── components/
│   └── provider/NextAuthProvider.tsx    # unchanged (SessionProvider still in next-auth/react)
└── utils/
    └── actions/*.ts                     # all use `await auth()` instead of getServerSession

next.config.mjs                           # Turbopack top-level; PWA → Sentry wrap order fixed
postcss.config.mjs                        # RENAMED from .js; @tailwindcss/postcss instead of tailwindcss
eslint.config.mjs                         # flat config
tailwind.config.ts                        # DELETED — config moves to globals.css
next-sitemap.config.js                    # DELETED
.eslintrc.json                            # DELETED
```

## Phasing (dependency-ordered)

Each phase ends with an independently testable deliverable. Earlier phases must be green before later phases start.

### Phase 0 — Pre-flight cleanup (≤ 1 task)
**Why first:** establish a clean baseline; nothing else is verifiable while the build is broken.

- Remove dead artifacts: `backward.sql`, `.tsc-out.txt`, leftover `*.tsbuildinfo`
- Remove stale `tsconfig.json` `include` entries that reference `.js` files alongside `.mjs` siblings
- Add `next-env.d.ts` to `.gitignore` if not present (already there)
- Confirm `npm run lint` output is the **expected** failure mode (broken `authConfig` missing) — not a fresh surprise

**Done when:** `npm run lint` exits with the *known* `authConfig` errors only. No surprises.

### Phase 1 — Auth.js v5 migration (the biggest blocker)
**Why second:** fixes the build, unblocks every other upgrade because nothing else can be verified until `auth()` returns a session.

Touch points (already identified by `grep`):
- **Create** `src/auth.ts` with v5 NextAuth config (Google + GitHub + Nodemailer providers, PrismaAdapter, JWT session strategy, custom session callback to inject `user.id`)
- **Create** `src/proxy.ts` wrapping `auth` for protected routes (`/new`, `/:userId/:slug/edit`, `/settings/*`, `/manage/*`, `/api/post/manage/*`, `/api/user/cloudinary/*`, `/api/email/*`)
- **Replace** `src/app/api/auth/[...nextauth]/route.ts` with v5 handler export
- **Replace** all `getServerSession(authConfig)` and `import { authConfig } from "@/utils/authConfig"` callsites → `await auth()` (call count to be confirmed by Phase 1 step 1: `grep -rln "authConfig\|getServerSession" src/`); expected distribution:
  - ~16 page files under `src/app/`
  - ~9 API route files under `src/app/api/`
  - ~9 server action files under `src/utils/actions/`
  - 1 component (`src/components/user/UserOrgProfile.tsx`)
- **Verify** every replacement site has a proper session-null guard (`if (!session) return unauthorized`) before using `session.user.id`. Do **not** introduce `session!.user.id` non-null assertions.
- **Verify** `src/utils/authConfig.ts` does not exist (it was already missing on disk before this branch started — nothing to delete, but the absence must hold).
- **Update** `next-auth.d.ts` to import `type DefaultSession` from `next-auth`.
- **Do not reintroduce** `src/middleware.ts`; Next 16 wants `proxy.ts`. If a middleware.ts file appears, delete it.
- **Update** `package.json`:
  - `next-auth: ^4.24.11` → `5.0.0-beta.32`
  - `@auth/prisma-adapter: ^2.11.1` → `^2.11.3`
  - Add `nodemailer` provider path correctly — v5 has `next-auth/providers/nodemailer` **only if installed separately**, otherwise use `@auth/core/providers/nodemailer`. Verify import path after install.
- **Provider import for Nodemailer:** in v5 beta, `next-auth/providers/nodemailer` exists; if not, fall back to `@auth/core/providers/nodemailer`.

**Done when:** `npm run lint` shows **zero** `authConfig` / `getServerSession` errors; `npm run build` reaches the route collection stage.

### Phase 2 — Next.js 15 → 16 upgrade
**Why third:** once auth works, the rest is mechanical codemod + config updates.

- Run the official codemod: `npx @next/codemod@latest upgrade latest`. This handles:
  - Sync `params`/`searchParams` → `Promise<...>` + `await`
  - Sync `cookies()`/`headers()`/`draftMode()` → `await cookies()`/etc.
- **Manually fix** anything the codemod misses:
  - `src/app/page.tsx` — no params
  - `src/app/(base-layout)/[userId]/page.tsx` — `params: { userId }`
  - `src/app/(base-layout)/[userId]/[slug]/page.tsx` — `params: { userId, slug }` (used at line 97)
  - `src/app/(base-layout)/[userId]/[slug]/edit/page.tsx` — `params: { userId, slug }`
  - `src/app/(base-layout)/[userId]/series/page.tsx` — `params: { userId }`
  - `src/app/(base-layout)/tag/[slug]/page.tsx` — `params: { slug }`
  - `src/app/(base-layout)/organization/[orgId]/page.tsx` — `params: { orgId }`
  - All API routes that read `req.url` or `req.nextUrl.searchParams` are fine — only `generateMetadata` / page `params` need changes.
- **Update `next.config.mjs`:**
  - Remove `--turbopack` flag from `dev`/`build` scripts in `package.json` (Turbopack is the default in Next 16)
  - Drop `experimental.turbopack` → top-level `turbopack: { ... }` if any options exist (currently none — just use defaults)
  - Fix wrapper order: `nextConfig` → `withPWA(nextConfig)` → `withSentryConfig(withPWA-wrapped-config, sentryOptions, uploadOptions)` (Sentry must wrap the outermost; the existing code already does this correctly, but **verify** it after bumping versions)
  - `headers()` and `redirects()` config in `next.config.mjs` should still work — async functions are fine
  - **Rename** `postcss.config.js` → `postcss.config.mjs` (Next 16 prefers `.mjs`)
- **Update `package.json` versions:**
  - `next: 15.5.15` → `^16.3.0`
  - `eslint-config-next: 15.3.3` → `^16.3.0`
  - `eslint: ^9.28.0` → `^10.8.0`
  - Add `@eslint/eslintrc: ^3.3.6` (flat config compat shim)
  - `nextjs-toploader: ^3.8.16` → `^3.9.17`
  - `@sentry/nextjs: ^10.43.0` → `^10.69.0`
- **Replace `.eslintrc.json` with `eslint.config.mjs`** (flat config). Minimal shim using `@eslint/eslintrc` `FlatCompat` to extend `next/core-web-vitals`.
- **`react-hook-form`, `@tanstack/react-query`, `@google/generative-ai`, Tiptap, react-hot-toast, resend, socket.io-client, react-intersection-observer, react-loading-skeleton, html-react-parser, @fortawesome/*, @paralleldrive/cuid2** — no version bumps needed; all already current.

**Done when:** `npm run dev` boots without errors; `npm run build` completes; `npm run lint` passes.

### Phase 3 — Tailwind 3 → 4 + daisyUI 4 → 5
**Why fourth:** can be done in parallel with Phase 2 conceptually but done after so any class-rendering issues are isolated to Tailwind changes, not entangled with Next 16 breaking changes.

- **Remove** `tailwindcss` from `package.json` devDeps (becomes runtime dep in v4)
- **Add** `tailwindcss@^4.3.3` as runtime dep (yes, v4 is a regular dep, not devDep)
- **Add** `@tailwindcss/postcss@^4.3.3` as devDep
- **Replace** `postcss.config.js` with `postcss.config.mjs`:
  ```js
  export default { plugins: { "@tailwindcss/postcss": {}, autoprefixer: {} } };
  ```
- **Delete** `tailwind.config.ts` (Tailwind 4 uses CSS-first config)
- **Rewrite** `src/app/globals.css`:
  ```css
  @import "tailwindcss";
  @plugin "daisyui" {
    themes: light --default, dark --prefersdark, mytheme;
  }
  @plugin "@tailwindcss/typography";
  /* mytheme tokens go here as CSS variables if custom theme is kept */
  ```
- **daisyUI 5 theme changes:** the `mytheme` block in `tailwind.config.ts` (with `primary`, `secondary`, etc.) becomes a CSS variable block via `@plugin "daisyui" { themes: mytheme {...} }` OR a separate `@plugin "daisyui/theme"` block.
- **Drop `tailwind-scrollbar`** — Tailwind 4 ships scrollbar utilities (`scrollbar-thin`, etc.). If `scrollbar` is actually used in the codebase, replace its classes with v4 equivalents; otherwise delete.
- **Bump** `daisyui: ^4.12.14` → `^5.7.15`
- **Bump** `@tailwindcss/typography: ^0.5.15` → `^0.5.16`

**Done when:** dev server renders all pages with correct colors and typography. `npm run build` succeeds.

### Phase 4 — Sitemap & misc cleanup
**Why last:** surface-level, low risk, finishes the migration.

- **Delete** `next-sitemap.config.js`
- **Remove** `next-sitemap` from `package.json`
- **Remove** `postbuild: "next-sitemap"` script
- **Create** `src/app/sitemap.ts`:
  ```ts
  import type { MetadataRoute } from "next";
  import prisma from "@/db";
  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // index page + per-post slugs
    const posts = await prisma.post.findMany({ select: { slug: true, updatedAt: true, author: { select: { username: true } } } });
    // ...
  }
  ```
- **Create** `src/app/robots.ts`:
  ```ts
  import type { MetadataRoute } from "next";
  export default function robots(): MetadataRoute.Robots { /* ... */ }
  ```
- **Re-run Sentry wizard** for Next 16: `npx @sentry/wizard@latest -i nextjs` (idempotent — will diff vs current config)
- **Update `tsconfig.json`:** the `include` array references `.js` files that don't exist (e.g., `src/middleware.js`). Either create them or drop the entries.

**Done when:** `npm run build` produces `sitemap.xml` and `robots.txt` in `.next/` without `next-sitemap` installed.

## Cross-cutting concerns

- **`socketURL.mjs` vs `src/constants.js`:** `next.config.mjs` imports `./src/utils/socketURL.mjs`. `tsconfig.json` includes `src/utils/socketURL.js` (wrong extension) and `src/constants.js`. Either fix the tsconfig includes or rename the files. Renaming `constants.js` → `constants.ts` and using the `.mjs` path consistently is cleaner.
- **`PostCSS config naming:** Next 16 prefers `postcss.config.mjs` over `.js`. Convert while in the area.
- **`src/utils/cn.ts` uses `clsx` + `tailwind-merge` — both already on modern versions, no change needed.**
- **Sentry `@sentry/nextjs` 10.69.0** is a minor bump from 10.43.0, but the SDK integration surface changed; re-run wizard to be safe.
- **`nextjs-toploader` API:** `<NextTopLoader showSpinner={false} />` in `layout.tsx` line 105 — API stable across 3.x. No code changes, just bump version.
- **Nodemailer provider in v5:** the current `authConfig.ts` (now deleted) imported `next-auth/providers/nodemailer`. In v5 beta this path **does** exist (it's part of the v5 package). After `npm install`, verify the path resolves; if not, switch to `@auth/core/providers/nodemailer`.

## Out of scope

- Cache Components / PPR (user opted off)
- DB schema migrations
- Provider list changes (keep Google, GitHub, Nodemailer as-is)
- Removing the `cuid2` dep in favor of Prisma's native `cuid`
- Prisma 7 (currently on 6.8.2; no 7 release yet — defer)
- React Compiler (separate effort)
- Tiptap 3 (still in beta on the package; defer)
- Mobile breakpoints / design changes
- Dropping `webpack` devDep — it's needed by some transitive; don't remove unless tsc complains

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `@ducanh2912/next-pwa` last released 2024, may not support Turbopack stable / Next 16 | High | Test in Phase 2 dev. If broken: replace with `next.config.mjs` PWA manifest only (`public/manifest.json` already exists) and rely on service worker registered manually. |
| `next-auth@5.0.0-beta.32` is beta; APIs may shift before stable | Medium | Pin to exact `5.0.0-beta.32`. Plan can re-execute if beta.33 breaks. |
| `daisyUI 5` theme config syntax differs from v4 | Medium | Phase 3 includes explicit theme conversion. Verify in dev. |
| Tailwind 4's CSS-first config means lost IDE autocomplete for theme tokens | Low | Use Tailwind 4 IntelliSense plugin (built-in to v4) |
| `eslint-config-next@16` may require additional plugins | Low | Flat config is forgiving; add as needed |
| Auth.js v5 Nodemailer import path differs from docs | Medium | Phase 1 explicitly verifies the import after install |
| `proxy.ts` matcher regex may need tuning (e.g., `/api/cron` for vercel.json cron must NOT be protected) | Low | Phase 1 specifies the matcher; cron path excluded |

## Verification (gate for "done")

After **every phase**:

1. `npm run lint` — exit 0
2. `npx tsc --noemit` — exit 0
3. `npm run build` — completes successfully
4. `npm run dev` — boots, no console errors, `/` returns 200, `/api/auth/session` returns valid JSON

After **all phases**:

5. `npx playwright test` — the 2 existing tests (`tests/feed.spec.ts`, `tests/search.spec.ts`) pass
6. Manual smoke:
   - Sign in with GitHub and Google
   - Sign in with email magic link (Nodemailer)
   - Create a post, edit it, delete it
   - Visit `/api/cron` (vercel.json cron target) without auth → expect 200 (not redirected)

## File-level change summary (rough counts)

| Action | Count |
|---|---|
| Create new | ~5 (auth.ts, proxy.ts, sitemap.ts, robots.ts, eslint.config.mjs) |
| Delete | ~5 (authConfig.ts, .eslintrc.json, next-sitemap.config.js, tailwind.config.ts, postcss.config.js → renamed) |
| Modify | ~45 (38 callsites for auth, plus configs and minor) |
| Add to package.json deps | ~6, remove ~2 |

## Open questions resolved

- ✅ Scope: full modern stack
- ✅ Cache Components: off
- ✅ Execution model: single plan, phased
- ✅ next-pwa: keep (risk acknowledged)
- ✅ next-sitemap: drop
- ✅ ESLint: flat config

## Open questions remaining (resolved during execution)

- Does `next-auth/providers/nodemailer` resolve under v5 beta.32? → resolve in Phase 1 step 2
- Does `@ducanh2912/next-pwa@10.2.9` work with Turbopack default in Next 16? → resolve in Phase 2 verification
- Is `tailwind-scrollbar` actually used? `grep -r "scrollbar-" src/` in Phase 3 → if zero hits, delete the dep

---

**Next step after this design is approved:** invoke `writing-plans` skill to produce `docs/superpowers/plans/2026-08-04-zefer-modernization.md` with bite-sized tasks per phase.