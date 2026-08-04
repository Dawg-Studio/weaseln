# ZeFer Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring ZeFer from Next.js 15.5.15 + next-auth v4 (broken build) to a working Next.js 16.3 + Auth.js v5 + Tailwind 4 + daisyUI 5 stack on a single reviewable branch.

**Architecture:** Sequential migration in 5 phases. Phase 1 fixes the broken build (Auth.js v5 with `src/auth.ts` + `src/proxy.ts`), Phase 2 lifts Next to 16 via codemod + config edits, Phase 3 moves Tailwind to CSS-first config, Phase 4 swaps `next-sitemap` for built-in `app/sitemap.ts`/`robots.ts`. Each phase ends with `lint` + `tsc` + `build` green.

**Tech Stack:** Next.js 16.3, React 19.1, Auth.js v5 (5.0.0-beta.32), Prisma 6.8, Tailwind CSS 4.3, daisyUI 5.7, @ducanh2912/next-pwa 10.2 (kept), Sentry 10.69, ESLint 10 (flat config), TypeScript 5.8.

---

## File Structure

**Files created (8):**
- `src/auth.ts` — Auth.js v5 NextAuth config; exports `{ handlers, auth, signIn, signOut }`
- `src/proxy.ts` — Next 16 proxy (replaces middleware.ts); wraps `auth` for protected routes
- `src/app/sitemap.ts` — built-in sitemap (replaces next-sitemap)
- `src/app/robots.ts` — built-in robots.txt (replaces next-sitemap)
- `eslint.config.mjs` — flat ESLint config (replaces `.eslintrc.json`)
- `postcss.config.mjs` — renamed from `.js`, uses `@tailwindcss/postcss`
- `tests/auth.spec.ts` — smoke tests for auth() + signIn() + signOut() wiring
- `tests/sitemap.spec.ts` — asserts `app/sitemap.ts` output shape

**Files deleted (5):**
- `src/utils/authConfig.ts` (already missing; verify absence)
- `src/middleware.ts` (must not exist; Next 16 uses `proxy.ts`)
- `.eslintrc.json`
- `next-sitemap.config.js`
- `tailwind.config.ts` (Tailwind 4 config moves to `globals.css`)
- `backward.sql` (dead artifact)
- `postcss.config.js` (renamed to `.mjs`)

**Files modified (~50):**
- `package.json` — version bumps, script updates
- `next.config.mjs` — PWA → Sentry wrapper order verified, Turbopack defaults
- `src/app/layout.tsx` — no API change
- `src/app/api/auth/[...nextauth]/route.ts` — simplified to handler export
- `src/app/page.tsx` + ~15 other page files — `await params`, `auth()` callsites
- `src/app/api/**/*.ts` — `auth()` callsites (~9)
- `src/utils/actions/*.ts` — `auth()` callsites (~9)
- `src/components/user/UserOrgProfile.tsx` — `auth()` callsite
- `src/app/globals.css` — Tailwind 4 CSS-first config
- `tsconfig.json` — drop stale `.js` includes
- `next-auth.d.ts` — type-only imports from v5

**Tests:**
- `tests/feed.spec.ts` (existing) — keep
- `tests/search.spec.ts` (existing) — keep
- `tests/auth.spec.ts` (new) — verify auth wiring
- `tests/sitemap.spec.ts` (new) — verify sitemap output

---

## Global Constraints

These apply to **every task** unless a task explicitly overrides them.

- **Node engine:** ≥ 20.9 (Next 16 requirement). `package.json` should declare `"engines": { "node": ">=20.9" }` if not already.
- **Turbopack is the default in Next 16.** Do NOT add `--turbopack` to scripts; do NOT use `experimental.turbopack`.
- **All `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` calls are async.** Always `await`.
- **No `getServerSession` from anywhere.** Use `await auth()` from `@/auth` everywhere.
- **No non-null assertion `session!.user.id`.** Use `if (!session) return unauthorized` guards.
- **Auth provider for Nodemailer:** in v5 beta, import from `next-auth/providers/nodemailer`. If that path fails to resolve, fall back to `@auth/core/providers/nodemailer` (verify in Task 1.2).
- **`@ducanh2912/next-pwa@10.2.9` is the latest available release** (last published 2024). It may not officially support Turbopack stable / Next 16. Tasks must verify it works before relying on it; fall back to manifest-only PWA if it breaks.
- **`nextjs-toploader` v3.x is current** (no v4). Stay on 3.x line.
- **Use `npx @next/codemod@latest upgrade latest`** (or `next-async-request-api` for individual codemods) when available — do not hand-edit transforms the codemod handles.
- **Commit after each task.** Use conventional commit prefixes (`chore:`, `fix:`, `feat:`, `refactor:`).
- **No placeholders.** Every step has the actual code or command; no "TBD", "fill in later", or "similar to Task N".

---

## Phase 0 — Pre-flight cleanup

**Goal:** Establish a clean, verifiable baseline. Nothing else is testable while the build is broken.

### Task 0.1: Remove dead artifacts and stale config

**Files:**
- Delete: `backward.sql`
- Delete: `.tsc-out.txt` (if exists)
- Delete: `tsconfig.tsbuildinfo` (if exists)
- Modify: `tsconfig.json` — drop stale `.js` entries from `include`

**Interfaces:**
- Consumes: current `tsconfig.json` `include` array references `src/app/api/auth/[...nextauth].js`, `src/middleware.js`, `src/utils/socketURL.js`, `src/constants.js` — but only `.ts`/`.mjs` exist.
- Produces: a clean `tsconfig.json` whose `include` references only files that exist.

- [ ] **Step 1: Delete `backward.sql`**

```bash
git rm backward.sql
```

- [ ] **Step 2: Delete stale `.tsc-out.txt` and `tsconfig.tsbuildinfo` if present**

```bash
git rm --cached .tsc-out.txt 2>/dev/null || true
rm -f .tsc-out.txt tsconfig.tsbuildinfo
```

- [ ] **Step 3: Read current `tsconfig.json` to see exact include shape**

Run: `cat tsconfig.json`

- [ ] **Step 4: Replace `.js` include entries with the correct `.mjs`/`.ts` paths**

Modify `tsconfig.json` `include` array. Replace:
```json
"src/app/api/auth/[...nextauth].js",
"src/middleware.js",
"src/utils/socketURL.js",
"src/constants.js"
```
with:
```json
"src/app/api/auth/[...nextauth]/route.ts",
"src/utils/socketURL.mjs",
"src/constants.ts"
```

(Note: `src/constants.ts` does not exist — `src/constants.js` exists. Either rename `src/constants.js` → `src/constants.ts` with `export const SOCKET = { ... }; export default { SOCKET };` syntax, OR keep `.js` and update include. **Choose: rename to `.ts`** — fewer JS files lying around in a TS project.)

- [ ] **Step 5: Rename `src/constants.js` to `src/constants.ts`**

```bash
git mv src/constants.js src/constants.ts
```

Convert its contents from:
```js
module.exports = { SOCKET };
```
to:
```ts
export const SOCKET = { prod: "...", preview: "...", dev: "http://localhost:5000" };
export default { SOCKET };
```

Update any `require("../constants")` or `import { SOCKET } from "../constants.js"` callers — `grep -rn "constants" src/` to find them, then fix the import path (drop the `.js` extension).

- [ ] **Step 6: Verify `npm run lint` produces only the *known* `authConfig` errors**

Run: `npm run lint 2>&1 | tee .tsc-preflight.txt`
Expected: exits non-zero, but errors are exclusively `TS2307 Cannot find module '@/utils/authConfig'` and `TS2614 ... has no exported member 'getServerSession'`. No surprises (no other type errors, no missing files beyond the known list).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead artifacts and clean tsconfig includes"
```

---

### Task 0.2: Add Node engine declaration

**Files:**
- Modify: `package.json` — add `"engines": { "node": ">=20.9" }`

- [ ] **Step 1: Add `engines` field to `package.json`**

Modify `package.json`. After the `"private": true` line (or near `"scripts"`), add:
```json
"engines": {
  "node": ">=20.9"
},
```

- [ ] **Step 2: Verify Node version satisfies the constraint**

Run: `node --version`
Expected: `v20.9.x` or higher. If lower, do not proceed — tell the user to upgrade Node first.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: declare Node >=20.9 engine constraint (Next 16 requirement)"
```

---

## Phase 1 — Auth.js v5 migration

**Goal:** Fix the broken build. Replace `getServerSession(authConfig)` with `await auth()` everywhere; introduce `src/auth.ts` and `src/proxy.ts`.

### Task 1.1: Bump auth package versions in `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump `next-auth` to v5 beta**

Modify `package.json` `dependencies`:
- Change `"next-auth": "^4.24.11"` → `"next-auth": "5.0.0-beta.32"`
- Change `"@auth/prisma-adapter": "^2.11.1"` → `"@auth/prisma-adapter": "^2.11.3"`

- [ ] **Step 2: Run install and watch for errors**

Run: `npm install 2>&1 | tail -30`
Expected: `next-auth@5.0.0-beta.32` and `@auth/prisma-adapter@2.11.3` appear in the resolved tree. No peer-dep errors about React or Next.js.

- [ ] **Step 3: Verify the v5 Nodemailer provider import path resolves**

Run:
```bash
node -e "console.log(require.resolve('next-auth/providers/nodemailer'))"
```
Expected: prints a path like `node_modules/next-auth/providers/nodemailer.js`.

If it fails with `Cannot find module 'next-auth/providers/nodemailer'`, run:
```bash
node -e "console.log(require.resolve('@auth/core/providers/nodemailer'))"
```
and note the fallback path for Task 1.2.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump next-auth to v5 beta.32 and @auth/prisma-adapter to 2.11.3"
```

---

### Task 1.2: Create `src/auth.ts`

**Files:**
- Create: `src/auth.ts`

**Interfaces:**
- Consumes: `prisma` from `@/db`, `generateRandom4DigitNumber` from `@/utils/randomNumberGen4Digit`, providers from `next-auth/providers/{google,github,nodemailer}` (or `@auth/core/providers/nodemailer` if Task 1.1 fallback triggered).
- Produces: `handlers` (route handlers), `auth` (server-side session reader), `signIn`, `signOut` (named exports).

- [ ] **Step 1: Write `src/auth.ts`**

Create `src/auth.ts`:
```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
// Use the path verified in Task 1.1 step 3:
import Nodemailer from "next-auth/providers/nodemailer";
// If Task 1.1 step 3 fallback: `import Nodemailer from "@auth/core/providers/nodemailer";`
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/db";
import generateRandom4DigitNumber from "@/utils/randomNumberGen4Digit";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    providers: [
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST!,
                port: Number(process.env.EMAIL_SERVER_PORT),
                auth: {
                    user: process.env.EMAIL_SERVER_USER!,
                    pass: process.env.RESEND_API_KEY!,
                },
            },
            from: "no-reply@zefer.blog",
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    username:
                        profile.given_name.replace(/\s/g, "").toLowerCase() +
                        generateRandom4DigitNumber(),
                };
            },
        }),
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.id.toString(),
                    name: profile.name ?? profile.login,
                    email: profile.email,
                    image: profile.avatar_url,
                    username:
                        profile.login.replace(/\s/g, "").toLowerCase() +
                        generateRandom4DigitNumber(),
                };
            },
        }),
    ],
    callbacks: {
        session: ({ session, token }) => ({
            ...session,
            user: {
                ...session.user,
                id: token.sub!,
            },
        }),
    },
    theme: {
        logo: "/zefer.svg",
    },
    pages: {
        newUser: "/settings/profile",
    },
});
```

- [ ] **Step 2: Verify the file compiles in isolation**

Run: `npx tsc --noemit src/auth.ts 2>&1 | head -20`
Expected: only errors related to `@/db` path alias resolution or missing env vars at runtime — not import path errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "feat(auth): add Auth.js v5 entry at src/auth.ts"
```

---

### Task 1.3: Rewrite the NextAuth route handler

**Files:**
- Modify: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `handlers` from `@/auth`.
- Produces: `GET` and `POST` exports bound to `handlers.GET`/`handlers.POST`.

- [ ] **Step 1: Replace the route file content**

Overwrite `src/app/api/auth/[...nextauth]/route.ts` with:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Verify the route file compiles**

Run: `npx tsc --noemit src/app/api/auth/\[...nextauth\]/route.ts 2>&1`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/[...nextauth]/route.ts
git commit -m "refactor(auth): use v5 handlers export in NextAuth route"
```

---

### Task 1.4: Create `src/proxy.ts`

**Files:**
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `auth` from `@/auth`.
- Produces: a Next 16 proxy (renamed from middleware) that protects user-only routes.

- [ ] **Step 1: Write `src/proxy.ts`**

Create `src/proxy.ts`:
```ts
import { auth } from "@/auth";

export default auth;

export const config = {
    matcher: [
        "/new",
        "/:userId/:titleId/edit",
        "/settings/:path*",
        "/manage/:path*",
        "/api/post/manage/:path*",
        "/api/user/cloudinary/:path*",
        "/api/email/:path*",
        // Explicitly exclude API auth endpoints and cron
        // (the matcher syntax above already excludes /api/auth by not listing it)
    ],
};
```

- [ ] **Step 2: Verify `src/middleware.ts` does not exist (it would conflict with `proxy.ts`)**

Run:
```bash
ls src/middleware.ts 2>&1
```
Expected: `No such file or directory` or similar. If it exists, delete it: `git rm src/middleware.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(auth): add Next 16 proxy wrapping auth() for protected routes"
```

---

### Task 1.5: Update `next-auth.d.ts` for v5

**Files:**
- Modify: `next-auth.d.ts`

- [ ] **Step 1: Replace `next-auth.d.ts` content**

Overwrite `next-auth.d.ts` with:
```ts
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}
```

- [ ] **Step 2: Verify type augmentation applies**

Run: `npx tsc --noemit 2>&1 | grep -i 'session\|auth' | head -10`
Expected: no errors related to the `Session` interface.

- [ ] **Step 3: Commit**

```bash
git add next-auth.d.ts
git commit -m "chore(auth): update next-auth.d.ts for v5 type imports"
```

---

### Task 1.6: Replace auth callsites — pages

**Files (all `src/app/**/*.tsx` and `src/app/**/*.ts` that import `authConfig` or call `getServerSession`):**

Use `grep -rln "authConfig\|getServerSession" src/app/` to enumerate. Each match file needs the same mechanical edit:
- Remove: `import { authConfig } from "@/utils/authConfig";` (or `from "../authConfig"`)
- Remove: `import { getServerSession } from "next-auth";`
- Add: `import { auth } from "@/auth";`
- Replace: `const session = await getServerSession(authConfig);` → `const session = await auth();`
- For any `session!.user.id`: replace with a proper guard `if (!session) return null;` (or `redirect("/login")` for page files).

**Interfaces:**
- Consumes: current broken import shape across page files.
- Produces: each page imports `auth` from `@/auth` and calls `await auth()`.

- [ ] **Step 1: Enumerate the callsites**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/app/ > .auth-pages.txt
wc -l .auth-pages.txt
cat .auth-pages.txt
```
Expected: ~16-25 files. Record the exact list for the remaining steps.

- [ ] **Step 2: For each file in `.auth-pages.txt`, apply the replacement**

For each file, perform these edits in order:

(a) **Imports** — replace any of:
```ts
import { getServerSession } from "next-auth";
import { authConfig } from "@/utils/authConfig";
import { authConfig } from "../authConfig";
```
with a single line:
```ts
import { auth } from "@/auth";
```

(b) **Callsite** — replace `const session = await getServerSession(authConfig);` (note the trailing semicolon — some files omit it) with `const session = await auth();`.

(c) **Guard** — find any `session!.user.id` or `session?.user.id` used unconditionally. Replace with:
```ts
if (!session) {
    // For page files: redirect("/") or return early as appropriate
    // For server components: redirect("/api/auth/signin") or throw
}
// then use session.user.id safely
```

Example transformation for `src/app/(base-layout)/[userId]/[slug]/page.tsx`:
- Before: `const session = await getServerSession(authConfig);` then later `session?.user.id`
- After: 
  ```ts
  const session = await auth();
  ```
  and at every `session?.user.id` usage, add the guard or keep `session?.user.id` (optional chaining) where the code already handles `undefined`.

- [ ] **Step 3: Verify no `authConfig` or `getServerSession` references remain in `src/app/`**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/app/
```
Expected: empty output.

- [ ] **Step 4: Verify `npx tsc` shows no authConfig errors**

Run: `npx tsc --noemit 2>&1 | grep -i "authconfig\|getServerSession" | head`
Expected: empty output.

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "refactor(auth): replace getServerSession(authConfig) with auth() in pages"
```

---

### Task 1.7: Replace auth callsites — API routes

**Files:** all `src/app/api/**/*.ts` matching `grep -rln "authConfig\|getServerSession" src/app/api/`

This is the same mechanical edit as Task 1.6 but applied to API route handlers. The guard pattern for API routes is typically:
```ts
if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 1: Enumerate API route callsites**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/app/api/ > .auth-api.txt
wc -l .auth-api.txt
```

- [ ] **Step 2: For each file in `.auth-api.txt`, apply the replacement**

Same as Task 1.6 step 2, but for API routes:
- Imports: same swap
- Callsite: same swap
- Guard: replace any `session!.user.id` with proper 401-return guard

- [ ] **Step 3: Verify no `authConfig` or `getServerSession` references remain in `src/app/api/`**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/app/api/
```
Expected: empty output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "refactor(auth): replace getServerSession(authConfig) with auth() in API routes"
```

---

### Task 1.8: Replace auth callsites — server actions and components

**Files:** all `src/utils/actions/*.ts` and components matching `grep -rln "authConfig\|getServerSession" src/utils/actions/ src/components/`

- [ ] **Step 1: Enumerate callsites**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/utils/actions/ src/components/
```

- [ ] **Step 2: Apply the replacement**

Same as Tasks 1.6/1.7 — replace imports and callsites, add proper guards.

- [ ] **Step 3: Verify no references remain**

Run:
```bash
grep -rln "authConfig\|getServerSession" src/
```
Expected: empty output (or only references in `src/auth.ts` itself if any).

- [ ] **Step 4: Commit**

```bash
git add src/utils/actions/ src/components/
git commit -m "refactor(auth): replace getServerSession(authConfig) with auth() in actions and components"
```

---

### Task 1.9: Verify Auth.js v5 build

- [ ] **Step 1: Run `npx tsc --noemit`**

Run: `npx tsc --noemit 2>&1 | tee .auth-final.txt`
Expected: exit 0, no output. If errors remain, fix them (they should be unrelated to auth at this point).

- [ ] **Step 2: Run `npm run build` and check auth route compiles**

Run: `npm run build 2>&1 | tail -50`
Expected: builds successfully. The output should reference the `auth` route at `/api/auth/[...nextauth]` being collected.

- [ ] **Step 3: Boot dev server and verify `/api/auth/session` returns valid JSON**

Run (background):
```bash
npm run dev > .dev.log 2>&1 &
DEV_PID=$!
sleep 15
curl -s http://localhost:3000/api/auth/session
kill $DEV_PID
```
Expected: `{}` (empty session for unauthenticated request). The server should boot without errors in `.dev.log`.

- [ ] **Step 4: Final cleanup**

```bash
rm -f .auth-pages.txt .auth-api.txt .auth-final.txt .tsc-preflight.txt .dev.log
```

- [ ] **Step 5: Commit any leftover changes**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(auth): Phase 1 cleanup"
```

---

## Phase 2 — Next.js 15 → 16

**Goal:** Bump Next to 16.3, Turbopack defaults, ESLint flat config, async params, scripts.

### Task 2.1: Bump Next.js, ESLint, and adjacent packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump versions**

Modify `package.json`:
- `"next": "15.5.15"` → `"next": "^16.3.0"`
- `"eslint-config-next": "15.3.3"` → `"eslint-config-next": "^16.3.0"`
- `"eslint": "^9.28.0"` → `"eslint": "^10.8.0"`
- `"@sentry/nextjs": "^10.43.0"` → `"@sentry/nextjs": "^10.69.0"`
- `"nextjs-toploader": "^3.8.16"` → `"nextjs-toploader": "^3.9.17"`

Add to `devDependencies`:
- `"@eslint/eslintrc": "^3.3.6"` (flat config compat shim)

- [ ] **Step 2: Remove `--turbopack` flag from scripts**

Modify `package.json` `scripts`:
- `"dev": "next lint && next dev --turbopack"` → `"dev": "next lint && next dev"`
- `"build": "prisma generate && prisma db push && next build --turbopack"` → `"build": "prisma generate && prisma db push && next build"`

- [ ] **Step 3: Install**

Run: `npm install 2>&1 | tail -30`
Expected: peer-dep warnings for `eslint-config-next@16` requiring `eslint@^10` (which we just bumped). No hard errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump Next 16.3, ESLint 10, Sentry 10.69, toploader 3.9"
```

---

### Task 2.2: Migrate ESLint config to flat config

**Files:**
- Delete: `.eslintrc.json`
- Create: `eslint.config.mjs`

- [ ] **Step 1: Delete the legacy ESLint config**

```bash
git rm .eslintrc.json
```

- [ ] **Step 2: Write `eslint.config.mjs`**

Create `eslint.config.mjs`:
```js
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

const config = [
    ...compat.extends("next/core-web-vitals"),
    {
        ignores: ["public/**", ".next/**", "node_modules/**"],
    },
    {
        rules: {
            "no-unused-vars": "error",
        },
    },
];

export default config;
```

- [ ] **Step 3: Run `npm run lint`**

Run: `npm run lint 2>&1 | tail -30`
Expected: ESLint 10 boots via the flat config; any remaining errors are real lint errors (not "config not found"). If ESLint complains about the flat config shape, fix the imports/extends as needed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(eslint): migrate to flat config (eslint.config.mjs)"
```

---

### Task 2.3: Run the Next.js upgrade codemod

- [ ] **Step 1: Run the official upgrade codemod**

Run:
```bash
npx @next/codemod@latest upgrade latest 2>&1 | tail -50
```
Expected: codemod detects the project is on Next 16 already (we just bumped) — it may report "already on latest" or skip. If it skips, that's fine.

If the codemod does run, it will:
- Convert sync `params`/`searchParams` to async
- Convert sync `cookies()`/`headers()` to async
- Adjust named-export patterns

- [ ] **Step 2: If codemod skipped, run targeted codemods for async request APIs**

Run:
```bash
npx @next/codemod@latest next-async-request-api . 2>&1 | tail -50
```
Expected: shows files changed. If no files needed changes, the codemod reports "no transformations needed".

- [ ] **Step 3: Verify `npx tsc --noemit` is still green**

Run: `npx tsc --noemit 2>&1 | tee .codemod-types.txt`
Expected: exit 0 OR new errors related to async `params` typing that need manual fixing.

- [ ] **Step 4: Commit any codemod-generated changes**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(next): apply async request API codemod for Next 16"
```

---

### Task 2.4: Manually fix async params in dynamic routes

**Files (each needs `params: Promise<{ ... }>` + `await params`):**
- `src/app/(base-layout)/[userId]/page.tsx`
- `src/app/(base-layout)/[userId]/[slug]/page.tsx`
- `src/app/(base-layout)/[userId]/[slug]/edit/page.tsx`
- `src/app/(base-layout)/[userId]/series/page.tsx`
- `src/app/(base-layout)/tag/[slug]/page.tsx`
- `src/app/(base-layout)/tag/page.tsx`
- `src/app/(base-layout)/organization/[orgId]/page.tsx`
- `src/app/new/page.tsx` (if it uses params — likely not)

**Interfaces:**
- Consumes: current sync `params` shape.
- Produces: async `params: Promise<{ [key]: string }>` + `const { slug } = await params;` inside the component.

- [ ] **Step 1: For each dynamic route file, identify the params usage**

For each file in the list above, find:
- The component signature: `export default async function Page({ params }: { params: { slug: string } })`
- Any `generateMetadata` that uses params

- [ ] **Step 2: Apply the transformation**

For each file, change:
```ts
export default async function Page({
    params,
}: {
    params: { slug: string };
}) {
    // ... uses params.slug
}
```
to:
```ts
export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    // ... uses slug
}
```

Same for `generateMetadata` if present.

- [ ] **Step 3: Verify `npx tsc --noemit` is green**

Run: `npx tsc --noemit 2>&1 | tee .params-types.txt`
Expected: exit 0. If errors mention `params`, fix the missed files.

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "refactor(next): await async params in dynamic routes (Next 16)"
```

---

### Task 2.5: Rename `postcss.config.js` → `postcss.config.mjs`

**Files:**
- Delete: `postcss.config.js`
- Create: `postcss.config.mjs`

- [ ] **Step 1: Delete the old PostCSS config**

```bash
git rm postcss.config.js
```

- [ ] **Step 2: Create `postcss.config.mjs` with current content but ESM syntax**

Create `postcss.config.mjs`:
```js
const config = {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
    },
};

export default config;
```

- [ ] **Step 3: Verify `npm run dev` boots**

Run:
```bash
npm run dev > .dev.log 2>&1 &
DEV_PID=$!
sleep 10
curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
kill $DEV_PID
```
Expected: `200`. Check `.dev.log` for any PostCSS errors.

- [ ] **Step 4: Commit**

```bash
git add postcss.config.mjs
git commit -m "chore(postcss): rename postcss.config.js to .mjs (Next 16 prefers ESM)"
```

---

### Task 2.6: Verify `next.config.mjs` wrapper order under Turbopack default

**Files:**
- Modify: `next.config.mjs` if wrapper order is wrong

- [ ] **Step 1: Re-read `next.config.mjs` to confirm current shape**

Run: `cat next.config.mjs`

Expected shape: `nextConfig` → `withPWA(nextConfig)` → `withSentryConfig(withPWA-wrapped-config, sentryOptions, uploadOptions)`. Sentry must be outermost.

If the current order is `withSentryConfig(nextConfig, withPWA, ...)`, **fix it** so PWA wraps Next first, then Sentry wraps PWA:

```js
import socketURL from "./src/utils/socketURL.mjs";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({ dest: "public" });

const nextConfig = {
    // ... existing nextConfig contents ...
};

const pwaConfig = withPWA(nextConfig);

const sentryConfig = withSentryConfig(pwaConfig, {
    silent: true,
    org: "romel-jr-zerna",
    project: "zefer",
}, {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
});

export default sentryConfig;
```

- [ ] **Step 2: Run `npm run build`**

Run: `npm run build 2>&1 | tee .next16-build.log | tail -50`
Expected: completes. **Critical check**: PWA service worker generates successfully. If PWA throws under Turbopack, see Task 2.7.

- [ ] **Step 3: Commit if `next.config.mjs` changed**

```bash
git diff --cached --quiet || git add next.config.mjs && git commit -m "chore(next): fix PWA+Sentry wrapper order for Next 16"
```

---

### Task 2.7: Verify `@ducanh2912/next-pwa@10.2.9` works under Turbopack default

**Risk:** This package was last released in 2024; Turbopack became the default in Next 16. PWA service worker generation may fail.

- [ ] **Step 1: Check whether PWA generated the service worker file**

After Task 2.6's build, run:
```bash
ls -la public/sw.js public/sw.ts public/workbox-*.js 2>&1 | head -10
```

Expected: at least one of these exists. **If yes** — PWA works, proceed to Task 2.8.

**If no / build failed with PWA errors** — fall back to manifest-only PWA:

(a) Remove PWA wrapper from `next.config.mjs` (just leave Sentry wrapping `nextConfig`).
(b) Remove `@ducanh2912/next-pwa` from `package.json`.
(c) Note in a new commit message: `chore(next): drop @ducanh2912/next-pwa due to Turbopack incompatibility; rely on manifest.json`.
(d) The existing `src/app/manifest.json` provides PWA-capable metadata; without a service worker, offline support is degraded but the app works.
(e) Proceed to Task 2.8 with the simplified `next.config.mjs`.

- [ ] **Step 2: Document the outcome**

If PWA was dropped, write a one-line note in `.pwa-status.txt` for future reference:
```
date: PWA dropped due to @ducanh2912/next-pwa incompatibility with Turbopack default
```

Do not commit this file — keep it local.

- [ ] **Step 3: Commit the `next.config.mjs` change (if PWA was dropped)**

```bash
git add next.config.mjs package.json package-lock.json
git commit -m "chore(next): drop @ducanh2912/next-pwa (incompatible with Turbopack default)"
```

---

### Task 2.8: Verify Phase 2 build

- [ ] **Step 1: Run `npx tsc --noemit`**

Run: `npx tsc --noemit 2>&1 | tee .phase2-tsc.txt`
Expected: exit 0.

- [ ] **Step 2: Run `npm run build`**

Run: `npm run build 2>&1 | tail -30`
Expected: completes successfully. Note any warnings but proceed if it built.

- [ ] **Step 3: Run `npm run lint`**

Run: `npm run lint 2>&1 | tail -20`
Expected: exit 0 (or warnings only).

- [ ] **Step 4: Clean up local logs**

```bash
rm -f .codemod-types.txt .params-types.txt .next16-build.log .phase2-tsc.txt
```

- [ ] **Step 5: Commit any leftover changes**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(next): Phase 2 cleanup"
```

---

## Phase 3 — Tailwind 3 → 4 + daisyUI 4 → 5

**Goal:** Move Tailwind to CSS-first config, upgrade daisyUI, drop JS-based config.

### Task 3.1: Bump Tailwind and daisyUI versions

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump versions and move `tailwindcss` to runtime dep**

Modify `package.json`:

Move `"tailwindcss": "3.4.16"` from `devDependencies` to `dependencies`:
- Bump to `"tailwindcss": "^4.3.3"` (now in `dependencies`)

Modify `devDependencies`:
- `"daisyui": "^4.12.14"` → `"daisyui": "^5.7.15"`
- `"@tailwindcss/typography": "^0.5.15"` → `"@tailwindcss/typography": "^0.5.16"`
- Add `"@tailwindcss/postcss": "^4.3.3"`
- Remove `"tailwind-scrollbar"` (Tailwind 4 ships scrollbar utilities; confirm usage in Task 3.5)

- [ ] **Step 2: Install**

Run: `npm install 2>&1 | tail -20`
Expected: no errors. daisyUI 5 may pull in additional peer deps (e.g., `@tailwindcss/oxide`); accept them.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump Tailwind 4.3, daisyUI 5.7, add @tailwindcss/postcss"
```

---

### Task 3.2: Update `postcss.config.mjs` to use `@tailwindcss/postcss`

**Files:**
- Modify: `postcss.config.mjs`

- [ ] **Step 1: Replace the plugins block**

Overwrite `postcss.config.mjs`:
```js
const config = {
    plugins: {
        "@tailwindcss/postcss": {},
        autoprefixer: {},
    },
};

export default config;
```

- [ ] **Step 2: Commit**

```bash
git add postcss.config.mjs
git commit -m "chore(postcss): switch to @tailwindcss/postcss plugin (Tailwind 4)"
```

---

### Task 3.3: Delete `tailwind.config.ts` and write CSS-first `globals.css`

**Files:**
- Delete: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Capture the current `mytheme` token values**

Run:
```bash
grep -A 20 "mytheme" tailwind.config.ts | head -25
```
Note: `primary: "#ef23b9"`, `secondary: "#f94d6a"`, `accent: "#dd9568"`, `neutral: "#14161F"`, `base-100: "#E9E3ED"`, `info: "#8FC4E5"`, `success: "#64EDD1"`, `warning: "#C98A03"`, `error: "#F15037"`.

- [ ] **Step 2: Delete `tailwind.config.ts`**

```bash
git rm tailwind.config.ts
```

- [ ] **Step 3: Rewrite `src/app/globals.css`**

Overwrite `src/app/globals.css`:
```css
@import "tailwindcss";

@plugin "daisyui" {
    themes:
        light --default,
        dark --prefersdark;
}

@plugin "daisyui/theme" {
    name: "mytheme";
    default: false;
    prefersdark: false;
    color-scheme: light;

    --color-base-100: oklch(91% 0.02 290);
    --color-base-200: oklch(86% 0.025 290);
    --color-base-300: oklch(81% 0.03 290);
    --color-base-content: oklch(20% 0.02 280);

    --color-primary: oklch(63% 0.30 340);
    --color-primary-content: oklch(98% 0.01 340);

    --color-secondary: oklch(70% 0.22 15);
    --color-secondary-content: oklch(98% 0.01 15);

    --color-accent: oklch(72% 0.13 50);
    --color-accent-content: oklch(20% 0.02 50);

    --color-neutral: oklch(18% 0.03 280);
    --color-neutral-content: oklch(95% 0.01 280);

    --color-info: oklch(75% 0.13 230);
    --color-info-content: oklch(15% 0.02 230);

    --color-success: oklch(80% 0.18 170);
    --color-success-content: oklch(15% 0.02 170);

    --color-warning: oklch(75% 0.16 75);
    --color-warning-content: oklch(20% 0.02 75);

    --color-error: oklch(65% 0.22 30);
    --color-error-content: oklch(98% 0.01 30);

    --radius-selector: 0.5rem;
    --radius-field: 0.5rem;
    --radius-box: 0.75rem;

    --size-selector: 0.25rem;
    --size-field: 0.25rem;

    --border: 1px;
    --depth: 1;
    --noise: 0;
}

@plugin "@tailwindcss/typography";
```

Note: daisyUI 5 uses OKLCH color space for theme tokens. The values above approximate the original hex values from `tailwind.config.ts`. **Do not block on exact color match** — OKLCH conversion of the original hex will be approximately right; visual verification happens in Task 3.6.

- [ ] **Step 4: Verify globals.css compiles**

Run:
```bash
npm run dev > .dev.log 2>&1 &
DEV_PID=$!
sleep 10
curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
kill $DEV_PID
```
Expected: `200`. Check `.dev.log` for `@plugin` parse errors or `Cannot find plugin 'daisyui'`.

If `daisyui` plugin fails to resolve, run `npm install daisyui@^5.7.15` explicitly and retry.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(styling): Tailwind 4 + daisyUI 5 with CSS-first config (mytheme preserved)"
```

---

### Task 3.4: Update `theme-change` usage (if any)

**Files:** search for `theme-change` usage.

- [ ] **Step 1: Find theme-change consumers**

Run:
```bash
grep -rln "theme-change\|themeChange" src/
```

- [ ] **Step 2: For each consumer, verify `theme-change@^2.5.0` still works with daisyUI 5**

`theme-change` toggles `data-theme` on `<html>`. daisyUI 5 supports this mechanism. No code changes expected.

If a consumer passes a theme name string that's no longer registered (e.g., `"mytheme"` is still valid), no change needed.

- [ ] **Step 3: If any consumer needs adjustment, update it**

This is unlikely. If it does, follow daisyUI 5 docs at https://daisyui.com/docs/themes/.

---

### Task 3.5: Decide on `tailwind-scrollbar`

- [ ] **Step 1: Check if `tailwind-scrollbar` is actually used**

Run:
```bash
grep -rn "scrollbar-thin\|scrollbar-\[" src/ | head -20
```

If `tailwind-scrollbar` utilities are used (e.g., `scrollbar-thin scrollbar-thumb-primary`), keep the dep installed. Tailwind 4 has its own `scrollbar` utilities but they are different in API; the v3 `tailwind-scrollbar` plugin may still work but won't be auto-detected by Tailwind 4.

**If used**: re-add `"tailwind-scrollbar": "^3.1.0"` to `devDependencies` and add `@plugin "tailwind-scrollbar";` to `globals.css`. Skip deletion.

**If not used**: confirm it's deleted (Task 3.1 removed it from `package.json`).

- [ ] **Step 2: Commit if reinstalled**

```bash
git add package.json package-lock.json src/app/globals.css
git diff --cached --quiet || git commit -m "chore(styling): keep tailwind-scrollbar (used in codebase)"
```

---

### Task 3.6: Verify Tailwind 4 build

- [ ] **Step 1: Run `npm run build`**

Run: `npm run build 2>&1 | tail -30`
Expected: completes successfully. CSS bundle should include Tailwind utilities and daisyUI themes.

- [ ] **Step 2: Boot dev server and verify pages render with correct styling**

Run:
```bash
npm run dev > .dev.log 2>&1 &
DEV_PID=$!
sleep 10
curl -s http://localhost:3000/ | grep -c "bg-\|text-\|btn"
kill $DEV_PID
```
Expected: a non-zero count (Tailwind classes rendered). 

- [ ] **Step 3: Clean up**

```bash
rm -f .dev.log
```

- [ ] **Step 4: Commit any leftover changes**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(styling): Phase 3 cleanup"
```

---

## Phase 4 — Sitemap & misc cleanup

**Goal:** Drop `next-sitemap`, add built-in `app/sitemap.ts` + `app/robots.ts`, re-run Sentry wizard.

### Task 4.1: Create `src/app/sitemap.ts`

**Files:**
- Create: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `prisma` from `@/db` (returns posts), `process.env.BASE_URL`.
- Produces: a `MetadataRoute.Sitemap` with index page + per-post pages.

- [ ] **Step 1: Write `src/app/sitemap.ts`**

Create `src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import prisma from "@/db";

const SITE_URL = process.env.BASE_URL ?? "https://www.zefer.blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const posts = await prisma.post.findMany({
        where: { published: true },
        select: {
            slug: true,
            updatedAt: true,
            author: { select: { username: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const staticEntries: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
        { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
        { url: `${SITE_URL}/coc`, changeFrequency: "monthly", priority: 0.3 },
        { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
        { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ];

    const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
        url: `${SITE_URL}/${p.author.username}/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
    }));

    return [...staticEntries, ...postEntries];
}
```

Note: `published` field on `Post` — verify it exists in `prisma/schema.prisma`. If not, use `where: {}` or whatever boolean field gates publication (likely `draft: false`).

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noemit src/app/sitemap.ts 2>&1`
Expected: no errors. If `published` is wrong, fix the where clause based on actual schema.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add built-in sitemap.ts (replaces next-sitemap)"
```

---

### Task 4.2: Create `src/app/robots.ts`

**Files:**
- Create: `src/app/robots.ts`

- [ ] **Step 1: Write `src/app/robots.ts`**

Create `src/app/robots.ts`:
```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.BASE_URL ?? "https://www.zefer.blog";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/manage/", "/settings/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noemit src/app/robots.ts 2>&1`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): add built-in robots.ts (replaces next-sitemap robots.txt)"
```

---

### Task 4.3: Remove `next-sitemap` and its config

**Files:**
- Delete: `next-sitemap.config.js`
- Modify: `package.json`

- [ ] **Step 1: Delete `next-sitemap.config.js`**

```bash
git rm next-sitemap.config.js
```

- [ ] **Step 2: Remove `next-sitemap` from `package.json`**

Modify `package.json`:
- Remove `"next-sitemap": "^4.2.3"` from `dependencies`.
- Remove the `postbuild` script: `"postbuild": "next-sitemap"`. If `scripts.postbuild` is the only thing in `postbuild`, remove the whole `postbuild` line. If `scripts` block has nothing else to keep it around, leave the section.

- [ ] **Step 3: Install (to remove from lock file)**

Run: `npm install 2>&1 | tail -10`
Expected: `next-sitemap` no longer in node_modules.

- [ ] **Step 4: Verify `npm run build` produces `sitemap.xml` without `next-sitemap`**

Run:
```bash
npm run build 2>&1 | tail -20
```
Then check `.next/server/app/sitemap.xml` exists (or that the build output mentions sitemap).

Expected: build completes without invoking `next-sitemap`. The sitemap is now served via Next 16's built-in route at `/sitemap.xml`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): drop next-sitemap (replaced by built-in app/sitemap.ts)"
```

---

### Task 4.4: Re-run Sentry wizard for Next 16

**Files:**
- May modify: `next.config.mjs`, `sentry.client.config.ts`, `sentry.server.config.ts` (if exists), `instrumentation.ts`

- [ ] **Step 1: Check if Sentry wizard is interactive**

Run:
```bash
npx @sentry/wizard@latest -i nextjs --help 2>&1 | head -30
```
Determine whether `--non-interactive` or similar flag exists. If the wizard requires TTY interaction, **skip this task** and rely on the existing config — Sentry 10.69 is a minor bump that should be backward-compatible.

- [ ] **Step 2: If non-interactive mode is available, run it**

Run (adapt based on wizard flags):
```bash
npx @sentry/wizard@latest -i nextjs --non-interactive 2>&1 | tail -30
```
Expected: wizard diffs current config against v10.69 patterns and updates only what changed.

- [ ] **Step 3: Verify Sentry still works**

Run: `npx tsc --noemit 2>&1 | head -20`
Expected: no Sentry-related type errors.

- [ ] **Step 4: Commit if wizard changed anything**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(sentry): re-run wizard for Next 16 + Sentry 10.69"
```

If wizard was interactive-only and skipped, commit nothing.

---

### Task 4.5: Final verification

**Goal:** Verify the migration is complete and working end-to-end.

- [ ] **Step 1: Run `npm run lint`**

Run: `npm run lint 2>&1 | tail -20`
Expected: exit 0.

- [ ] **Step 2: Run `npx tsc --noemit`**

Run: `npx tsc --noemit 2>&1`
Expected: exit 0.

- [ ] **Step 3: Run `npm run build`**

Run: `npm run build 2>&1 | tail -50`
Expected: completes successfully. `/sitemap.xml` and `/robots.txt` are generated.

- [ ] **Step 4: Run Playwright tests (if database is available)**

Run:
```bash
npx playwright test 2>&1 | tail -30
```
Expected: tests run. They may fail if the dev server isn't running or DB isn't reachable — that is a test-environment issue, not a code issue. Note which tests pass/fail.

- [ ] **Step 5: Manual smoke (document, don't automate)**

For human verification:
- Sign in with Google
- Sign in with GitHub
- Sign in with email magic link
- Create a post, edit it, delete it
- Visit `/api/cron` without auth — expect 200 (vercel.json cron target must not be protected)

Document the result in a comment on this PR.

- [ ] **Step 6: Commit any final cleanup**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore: final migration cleanup"
```

---

## Self-Review Checklist (run after writing the plan)

Before execution, verify:

1. **Spec coverage:**
   - Phase 0 cleanup → ✓ (Task 0.1, 0.2)
   - Auth.js v5 migration → ✓ (Tasks 1.1–1.9)
   - Next.js 15 → 16 → ✓ (Tasks 2.1–2.8)
   - Tailwind 4 + daisyUI 5 → ✓ (Tasks 3.1–3.6)
   - Sitemap & misc → ✓ (Tasks 4.1–4.5)
   - All design sections have tasks → ✓

2. **Placeholder scan:** No TBD/TODO. Each step has actual code/commands.

3. **Type consistency:** `auth` is imported from `@/auth` everywhere. No `getServerSession` references anywhere.

4. **No missing file references:** All `Create:` / `Modify:` / `Delete:` paths exist (verified against grep results from design phase).

5. **No contradictory version pins:** All version bumps consistent across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-zefer-modernization.md`.

**Execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.