# Migrate sign-in magic-link from SMTP/Nodemailer to Resend SDK

**Issue:** https://github.com/Dawg-Studio/weaseln/issues/12
**Branch:** `chore/issue-12-magic-link-to-resend`
**Date:** 2026-08-31

## Problem

`src/auth.ts` sends magic-link sign-in emails through Nodemailer connected to Resend's SMTP relay (`smtp.resend.com`), with `RESEND_API_KEY` doing double duty as the SMTP password. The `resend` SDK (`^4.5.1`) is already installed and used by `src/app/api/email/send/verification/route.ts` for the post-publish verification email — sign-in just never got migrated. The SMTP configuration vars (`EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`) exist only to satisfy the Nodemailer provider's type.

## Decision

Use the **official Auth.js Resend provider** (`next-auth/providers/resend`, shipped in the installed `next-auth@5.0.0-beta.32` via `@auth/core`), not an override of the Nodemailer provider as the issue originally sketched. The official provider:

- speaks the Resend HTTP API directly (no SMTP, no Nodemailer runtime),
- throws `Resend error: {...}` on non-OK responses — satisfying the AGENTS.md throw-on-silent-errors rule for free, whereas the Resend SDK's `emails.send()` returns `{ data, error }` without throwing and would have required a manual check,
- ships a themed sign-in email template at no cost.

Trade-off accepted: the provider id changes from `nodemailer` to `resend`, which changes the auth callback path. Two references must follow: the dev-login endpoint and a README example output line.

## Change surface (4 files)

### `src/auth.ts`

- Drop `import Nodemailer from "next-auth/providers/nodemailer";`, add `import Resend from "next-auth/providers/resend";`
- Replace the `Nodemailer({ server: {...}, from: ... })` block inside the non-prod provider array with:

```ts
Resend({
    apiKey: process.env.RESEND_API_KEY!,
    from: "no-reply@weaseln.blog",
}),
```

`from` must be set explicitly: the provider default is `Auth.js <no-reply@authjs.dev>`, which Resend would reject — `no-reply@weaseln.blog` is the current sign-in sender on a verified domain.

### `src/app/api/dev-login/route.ts` (line 52)

One string: `/api/auth/callback/nodemailer` → `/api/auth/callback/resend`. The callback path is derived from the provider id, and dev-login constructs the URL by hand.

### `README.md` (line 135)

Update the dev-login example output to show the `resend` callback path so the doc matches reality.

### `.env.example`

Delete the three `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` / `EMAIL_SERVER_USER` lines under the Resend comment. `RESEND_API_KEY` stays (now consumed only via the HTTP API).

## Explicitly out of scope

- Custom sign-in email HTML/template — the provider's built-in themed email is used as-is; a branded template pass is a follow-up.
- Changing the dev-only provider gating (`isProd ? [google] : [...]`) — production behavior is untouched by this change.
- Removing the `nodemailer` package — it is not a direct dependency (nothing imports it outside `next-auth` internals); `package.json` is untouched.
- Editing developers' local `.env` files — noted in the PR description as manual cleanup for anyone who copied `.env.example`.
- Historical docs (`docs/superpowers/plans/2026-08-24-remove-gemini-autocomplete.md` mentions the old callback path) — artifacts of past work, left as-is. `docs/QA.md` has no `nodemailer`/`EMAIL_SERVER` references and needs no edit.

## Behavior & compatibility

- Same auth flow: Prisma adapter `VerificationToken` rows, JWT session strategy, `/api/auth/signin` entry, 24-hour token `maxAge` (identical to Nodemailer's default) — only the transport and callback path change.
- Failed sends now surface as an error on the sign-in flow instead of a silent "check your inbox" with nothing delivered (Nodemailer/SMTP previously threw on transport failure too; parity is preserved).
- The verification-email route (`/api/email/send/verification`) is untouched and keeps its own `Resend` client instance.

## Verification (per `AGENTS.md` pre-completion checklist)

1. `npx eslint .` exits 0.
2. `npx tsc --noEmit` exits 0.
3. Dev-server smoke test: start with `ENABLE_DEV_LOGIN=true`, POST `alice@test.com` to `/api/dev-login`, confirm the returned URL now points at `/api/auth/callback/resend`, navigate it, and confirm login lands the user on `/`.
4. Optional real-send check (needs a live `RESEND_API_KEY` + verified domain): request a magic link through the sign-in email form and confirm delivery. Skippable when credentials are unavailable — dev-login covers the changed callback path.
