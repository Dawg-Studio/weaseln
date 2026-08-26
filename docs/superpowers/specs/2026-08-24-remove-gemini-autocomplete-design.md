# Remove Gemini autocomplete from WYSIWYG editor

**Issue:** https://github.com/Dawg-Studio/weaseln/issues/7
**Branch:** `chore/issue-7-remove-gemini-autocomplete`
**Date:** 2026-08-24

## Problem

The WYSIWYG post composer in `src/components/wysiwyg/Tiptap.tsx` ships an AI-powered autocomplete feature. After a user pauses typing for one second, the editor sends the post body to Google Gemini (`gemini-1.5-flash-latest`), renders the suggested continuation as a faded span at the cursor, and inserts it when the user presses Tab. The project is moving away from AI-generated content — the autocomplete is scraped knowledge that doesn't belong in a human-first publishing platform — so it has to go.

The work is a pure deletion. No replacement feature, no behavior change beyond the autocomplete itself, no new code paths.

## Scope

### Delete (whole files)

| File | Why |
| --- | --- |
| `src/utils/actions/wysiwyg.ts` | Contains nothing but `autocompleteGemini(words)` — the server action that calls Gemini. After deletion the file is empty, so the file itself goes. |
| `src/components/wysiwyg/custom_extensions/autocomplete.tsx` | Contains nothing but the `AutocompleteGemini` Tiptap extension (the `Decoration` widget + the Tab-insert handler). The `custom_extensions/` directory stays — `Image.tsx` lives there too. |

### Edit `src/components/wysiwyg/Tiptap.tsx`

| Lines | Why |
| --- | --- |
| 17–18 | Drop the two imports: `autocompleteGemini` from `@/utils/actions/wysiwyg`, `AutocompleteGemini` from `./custom_extensions/autocomplete`. |
| 88–90 | Drop the `insertContentState` state and `insertContentTimeout` ref — they only feed the autocomplete trigger. |
| 98 | Drop `AutocompleteGemini,` from the `extensions` array. |
| 110–120 | Drop the entire `editorProps.handleKeyDown(view, event)` block. Today it `preventDefault`s every Tab press and flips `insertContentState`; after removing the autocomplete there's no caller and the swallowed Tab breaks native keyboard focus — worse than useful. |
| 129–148 | Drop the `insertContentRef` ref and the `useEffect` that wires it (the one that calls `ed.commands.setMeta("triggerSuggestion", ...)` and `autocompleteGemini(words)`). |
| 150–161 | Drop the `useEffect` watching `insertContentState` that dispatches the debounced autocomplete call. |

### Keep (out of scope, explicitly)

- `src/utils/actions/tag.ts` — `validateTag()` still uses `@google/generative-ai` for tag validation. Issue #7 says "Other potential Gemini usage elsewhere … file a separate issue if needed." Confirmed with the user: strictly WYSIWYG only.
- `@google/generative-ai` in `package.json` and `package-lock.json` — `tag.ts` still imports it.
- `GOOGLE_AI_KEY` in `.env` — `tag.ts` still reads it.
- `docs/CONCERNS.md` — referenced by the issue body but does not exist in the repo. Not creating it.
- `README.md`, `docs/QA.md`, `docs/ASSETS.md`, `AGENTS.md` — no autocomplete references found.

## Edge cases / decisions

### Why delete the Tab `handleKeyDown` entirely instead of leaving it as a no-op

The current handler calls `event.preventDefault()` on every Tab inside the editor body. After removing the autocomplete there is no remaining reason for that hook. Keeping it would silently swallow Tab for keyboard users — a regression. Native browser behavior (focus the next focusable element) is the correct post-removal state.

### Why delete the whole `wysiwyg.ts` file instead of leaving it empty

The file has a single export. An empty `"use server"` module is a liability, not a stub — it would still be picked up by Next.js as a server-actions surface. Deleting the file is the only state worth shipping.

### Why leave `custom_extensions/autocomplete.tsx` file deletion even though `custom_extensions/` has other files

The `Image.tsx` extension lives in the same directory. The directory stays; only `autocomplete.tsx` goes.

## Verification (per `AGENTS.md` pre-completion checklist)

1. `npx eslint .` exits 0.
2. `npx tsc --noEmit` exits 0.
3. Manual smoke in a browser session:
   - Log in as alice via `/api/dev-login`.
   - Navigate to `/new`.
   - Type into the body editor. Confirm no autocomplete suggestion appears, no console errors.
   - Press Tab inside the body. Confirm focus moves to the next focusable element (not silently swallowed).
   - Upload a cover image, add tags, autosave triggers, publish lands on `/<username>/<titleId>`. No regression in image uploads, mentions, or other Tiptap features.

## Out of scope (explicit)

- Replacing tag validation with a non-AI implementation.
- Removing the `@google/generative-ai` dependency or `GOOGLE_AI_KEY` env var (both still needed by `tag.ts`).
- Any other Gemini references — to be filed as a separate issue.

## PR

Single commit on `chore/issue-7-remove-gemini-autocomplete`. Title: `chore(wysiwyg): remove Gemini autocomplete (#7)`. Body references the issue, lists the files deleted, calls out that `validateTag` and the `GOOGLE_AI_KEY` env var are intentionally untouched, and confirms the AGENTS.md pre-completion checklist passed.