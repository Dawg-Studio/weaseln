# Weaseln repository bootstrap — design

Date: 2026-08-20

## Goal

Detach the project from the ZeFer remote and establish it as a git repository
named **Weaseln**. This is a mechanical rename + unlink only. The actual
product/visual rebrand is explicitly deferred to separate work.

## Background

The working tree is currently `ZeFer`, a Next.js 16 open-source publishing
platform, with its git `origin` pointed at `github.com/leindfraust/ZeFer.git`.
The `ZeFer` brand appears in ~100+ locations (package name, `layout.tsx`
metadata, nav logo, email templates, legal pages, prisma seed, `docs/`,
`README.md`, hostnames such as `zefer.blog`). The user wants a fresh repo
identity named Weaseln now, with the deep rebrand handled separately.

## Scope

### In scope

1. **Unlink the remote.** `git remote remove origin`. Local commit history is
   preserved — this is not a re-init.
2. **Rename repository identity.**
   - `package.json`: `"name": "weaseln"`.
   - `package-lock.json`: `"name": "weaseln"`.
3. **Rename the project folder** `ZeFer` → `Weaseln` (performed last, via
   absolute path, because it changes the session working directory).

### Explicitly deferred (separate work)

- In-app display strings: `ZeFer` in `src/app/layout.tsx` (`APP_NAME`,
  description, `APP_TITLE_TEMPLATE`, OG image/URL), `Navigation.tsx` logo
  `alt`, email templates, and the `privacy`/`terms`/`coc`/`about` pages.
- Logo artwork and file names (`/zefer.svg`, `/zefer-bg.svg`).
- Color palette / theme tokens / homepage visual identity.
- Hostnames & domains: `zefer.blog`, `zefer.vercel.app`,
  `zefer-socket.onrender.com`, `zeferapi-documentation.vercel.app`, the
  `verification@zefer.blog` sender, the Cloudinary `zefer/post/draft` folder,
  SITE_URL defaults.
- Sentry `project: "zefer"` in `next.config.mjs` (renaming would break
  telemetry routing until a `weaseln` Sentry project exists).
- Prisma seed org name / slug (`ZeFer Test Org`, `welcome-to-zefer`) and the
  `docs/QA.md` references that depend on them.
- `README.md` body and `AGENTS.md` cross-references to dated `zefer-*` spec
  files.

After this pass the app still reads "ZeFer" in its UI and points at ZeFer
infrastructure; that is expected and owned by the deferred rebrand.

## Verification

- `git remote -v` → no output (remote removed).
- `grep -R "\"name\": \"weaseln\"" package.json package-lock.json` → matches.
- `npx eslint .` and `npx tsc --noEmit` → exit 0. No source files are touched
  in this pass, so this is trivially true; it guards against accidental
  collateral edits.

## Out of scope / non-goals

- No new git history start (`git init` fresh). History is kept.
- No code, feature, layout, or visual changes.
- No remote is added; the user will create / point at a Weaseln remote later.
