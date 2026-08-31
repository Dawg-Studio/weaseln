# Resend sign-in magic-link migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dev-only Nodemailer/SMTP magic-link provider with the official Auth.js Resend provider (HTTP API), and follow the provider-id change through dev-login and docs.

**Architecture:** `src/auth.ts` swaps `next-auth/providers/nodemailer` for `next-auth/providers/resend`, keeping the same sender address and dev-only gating. The provider id changes `nodemailer` → `resend`, which changes the auth callback path; the two hand-built references (dev-login route, README example) are updated to match. `.env.example` drops the three SMTP vars.

**Tech Stack:** Next.js 16 (App Router), next-auth@5.0.0-beta.32 (`@auth/core` Resend provider), Resend HTTP API, Prisma 6.8.2.

**Spec:** `docs/superpowers/specs/2026-08-31-resend-signin-migration-design.md`

## Global Constraints

- Per `AGENTS.md` pre-completion checklist: both `npx eslint .` and `npx tsc --noEmit` must exit 0 before declaring done. Running only one is not sufficient.
- No new dependencies — `next-auth@5.0.0-beta.32` already ships `next-auth/providers/resend`; `resend@4.5.1` stays for the verification-email route only.
- Sender address stays exactly `no-reply@weaseln.blog` (verified domain; provider default `no-reply@authjs.dev` would be rejected by Resend).
- Provider gating stays `isProd ? [google] : [...]` — production behavior untouched.
- Keep the pre-existing working-tree dirt (`prisma/migrations/20260818150000_profile_customization/migration.sql`, `.omo/`, `scripts/`) out of every commit — stage files explicitly by path.
- Commit messages follow the repo style: `type(scope): summary (#12)`.

**Testing note:** this repo's vitest suites cover unrelated modules. A unit test on `src/auth.ts` is not practical — importing it instantiates `PrismaClient` — and the change is provider configuration, so the verification cycle per task is `tsc`/`eslint` plus the Task 3 browser smoke test, mirroring the house style used by `2026-08-24-remove-gemini-autocomplete.md`.

---

## Task 0: Cut the feature branch

**Files:** none (git only)

The spec doc commits (`7d3851b`, `b05687b`) currently sit on `chore/unit-tests-only-drop-playwright`. Cut the feature branch from current HEAD so the spec rides along.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b chore/issue-12-magic-link-to-resend
```

Expected: `Switched to a new branch 'chore/issue-12-magic-link-to-resend'`. Pre-existing uncommitted files carry over untouched — leave them.

---

## Task 1: Swap the provider in `src/auth.ts` and clean `.env.example`

**Files:**
- Modify: `src/auth.ts:4` and `src/auth.ts:31-41`
- Modify: `.env.example` (Email Provider block)

**Interfaces:**
- Consumes: `next-auth/providers/resend` default export (type `EmailUserConfig`, accepts `{ apiKey, from }`).
- Produces: email provider with `id: "resend"` in the non-prod provider array. Task 2 depends on this id.

- [ ] **Step 1: Swap the import (line 4)**

In `src/auth.ts`, delete:

```ts
import Nodemailer from "next-auth/providers/nodemailer";
```

and add in its place (keep alphabetical position among the provider imports — after `github`, i.e. last):

```ts
import Resend from "next-auth/providers/resend";
```

- [ ] **Step 2: Replace the provider block (lines 31–41)**

Delete this block from the non-prod array:

```ts
          Nodemailer({
              server: {
                  host: process.env.EMAIL_SERVER_HOST!,
                  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
                  auth: {
                      user: process.env.EMAIL_SERVER_USER!,
                      pass: process.env.RESEND_API_KEY!,
                  },
              },
              from: "no-reply@weaseln.blog",
          }),
```

and add in its place:

```ts
          Resend({
              apiKey: process.env.RESEND_API_KEY!,
              from: "no-reply@weaseln.blog",
          }),
```

Expected: the non-prod array is `[google, Resend({...}), GitHub({...})]`; the prod array stays `[google]`.

- [ ] **Step 3: Verify no Nodemailer references remain in `src/`**

```bash
grep -rn "nodemailer\|Nodemailer\|EMAIL_SERVER_" src
```

Expected: no matches.

- [ ] **Step 4: Delete the SMTP vars from `.env.example`**

In `.env.example`, this block:

```
# Email Provider (Resend - https://resend.com)
RESEND_API_KEY=""
EMAIL_SERVER_HOST="smtp.resend.com"
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER="resend"
```

becomes:

```
# Email Provider (Resend - https://resend.com)
RESEND_API_KEY=""
```

- [ ] **Step 5: Run the type and lint checks**

```bash
npx eslint . ; npx tsc --noEmit
```

Expected: exit 0 for both. (The 26 pre-existing errors in `Tiptap.tsx` would be a failure here only if `AGENTS.md`/`docs/CONCERNS.md` say they're still open — if eslint fails with errors **not** caused by this change, stop and report instead of fixing out of scope.)

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts .env.example
git commit -m "chore(auth): send sign-in magic link via Resend HTTP API (#12)"
```

---

## Task 2: Follow the callback path into dev-login and README

**Files:**
- Modify: `src/app/api/dev-login/route.ts:52`
- Modify: `README.md:135`

**Interfaces:**
- Consumes: provider `id: "resend"` from Task 1 (the callback path is `/api/auth/callback/<id>`).

- [ ] **Step 1: Update the dev-login callback string**

In `src/app/api/dev-login/route.ts`, change line 52 from:

```ts
    const url = `${origin}/api/auth/callback/nodemailer?${new URLSearchParams({
```

to:

```ts
    const url = `${origin}/api/auth/callback/resend?${new URLSearchParams({
```

- [ ] **Step 2: Update the README example output**

In `README.md`, change line 135 from:

```
# → {"url":"http://localhost:3000/api/auth/callback/nodemailer?..."}
```

to:

```
# → {"url":"http://localhost:3000/api/auth/callback/resend?..."}
```

- [ ] **Step 3: Verify no stale `nodemailer` references remain outside historical docs**

```bash
grep -rn "nodemailer" src README.md docs/QA.md .env.example
```

Expected: no matches. (`docs/superpowers/plans/2026-08-24-remove-gemini-autocomplete.md` still mentions the old path — historical artifact, leave it.)

- [ ] **Step 4: Run the type and lint checks**

```bash
npx eslint . ; npx tsc --noEmit
```

Expected: exit 0 for both.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dev-login/route.ts README.md
git commit -m "chore(auth): point dev-login and README at the resend callback path (#12)"
```

---

## Task 3: Browser smoke test of the changed callback path

**Files:** none

This is the acceptance check: dev-login must produce a `resend` callback URL that actually logs the user in.

- [ ] **Step 1: Start the dev server with dev-login enabled**

```bash
npm run db:seed
ENABLE_DEV_LOGIN=true npm run dev
```

Wait for "Ready" in stdout.

- [ ] **Step 2: Request a dev-login URL**

```bash
curl -X POST http://localhost:3000/api/dev-login -H 'content-type: application/json' -d '{"email":"alice@test.com"}'
```

Expected response: `{"url":"http://localhost:3000/api/auth/callback/resend?callbackUrl=...&token=...&email=alice%40test.com"}` — the path must say `resend`, not `nodemailer`.

- [ ] **Step 3: Navigate the callback URL in a browser**

Open the URL from Step 2. Expected: redirected to `http://localhost:3000/` logged in as Alice Anderson (avatar/username visible in the nav). No 500, no `error=` query param.

- [ ] **Step 4: (Optional) Real-send check — only with live credentials**

If `RESEND_API_KEY` in `.env` is a live key and `weaseln.blog` is verified on Resend: sign out, go to `/api/auth/signin`, submit `alice@test.com` in the email form. Expected: Auth.js themed "Sign in to localhost:3000" email arrives at the inbox; clicking its link logs in. If no credentials, skip — dev-login already covers the changed callback path, and the provider's send path is stock Auth.js.

- [ ] **Step 5: Stop the dev server**

`Ctrl-C` in the dev server terminal.

---

## Task 4: Push the branch and open the PR

**Files:** none (git operations only)

- [ ] **Step 1: Confirm the branch contents**

```bash
git status
git log --oneline main..HEAD
```

Expected: clean working tree (except the pre-existing dirt never staged); commits include the two spec-doc commits plus:

1. `chore(auth): send sign-in magic link via Resend HTTP API (#12)`
2. `chore(auth): point dev-login and README at the resend callback path (#12)`

- [ ] **Step 2: Push**

```bash
git push -u origin chore/issue-12-magic-link-to-resend
```

Expected: branch pushed, tracking set.

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head chore/issue-12-magic-link-to-resend --title "chore(auth): send sign-in magic link via Resend HTTP API (#12)" --body "$(cat <<'EOF'
Closes #12.

Replaces the Nodemailer SMTP transport for sign-in magic links with the official Auth.js Resend provider (`next-auth/providers/resend`), which talks to Resend's HTTP API directly.

Changed:
- src/auth.ts — Nodemailer provider → Resend provider, same sender (`no-reply@weaseln.blog`), same dev-only gating, 24h token maxAge unchanged
- src/app/api/dev-login/route.ts — hand-built callback URL now `/api/auth/callback/resend` (provider id changed)
- README.md — dev-login example output updated to match
- .env.example — dropped EMAIL_SERVER_HOST / EMAIL_SERVER_PORT / EMAIL_SERVER_USER (RESEND_API_KEY stays)

Manual cleanup for local setups: remove the three EMAIL_SERVER_* lines from your .env.
Verification note: failed sends now throw (provider throws on non-OK responses) instead of silently pretending success.

Out of scope (per issue): custom sign-in email template; removing the nodemailer package (transitive only); touching the verification-email route.

Verified:
- npx eslint . exits 0
- npx tsc --noEmit exits 0
- dev-login returns /api/auth/callback/resend URL and logs Alice in via browser
EOF
)"
```

Expected: PR URL printed. Post the URL back. Stop here.
