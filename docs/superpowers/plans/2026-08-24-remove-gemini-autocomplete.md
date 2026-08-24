# Remove Gemini autocomplete from WYSIWYG editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the Gemini-powered autocomplete feature from the WYSIWYG post editor so the platform ships no AI-generated content suggestions.

**Architecture:** Pure deletion across three files. No new behavior. No replacement feature. The Tiptap editor keeps every other extension (`Placeholder`, `Image`, `Link`, `Youtube`) and every save/publish path. The `validateTag()` Gemini call in `tag.ts` and the `@google/generative-ai` dependency stay — they are explicitly out of scope per issue #7.

**Tech Stack:** Next.js 16.3.0 App Router, Tiptap 2.12, Prisma 6.8.2, Auth.js v5, ESLint 9, TypeScript 5.8.

## Global Constraints

- Node ≥ 20.9 (per `package.json` `engines`).
- Auth.js v5: `await auth()` from `@/auth`, never `getServerSession()`.
- Next 16: async `params`, `cookies()`, `headers()`, `draftMode()`. App Router only. Turbopack default — no `--turbopack` flag.
- File rename: middleware lives in `proxy.ts`, never `middleware.ts`.
- Prisma: generate with `npx prisma generate`, push with `npx prisma db push`, seed with `npm run db:seed`.
- Pre-completion checklist (per `AGENTS.md`): both must exit 0:
  - `npx eslint .`
  - `npx tsc --noEmit`
- Every interactive control needs an accessible name.
- QA bypass env var: `NEXT_PUBLIC_QA_NO_COVER=1` for headless publish flows without Cloudinary.
- Dev-login env var: `ENABLE_DEV_LOGIN=true` (gates `/api/dev-login`).
- DaisyUI 5 for any new HTML/JSX (no new UI here, but stay consistent if edits touch classnames).
- Out of scope: `validateTag()` Gemini call, `@google/generative-ai` package, `GOOGLE_AI_KEY` env var. Do not remove.

---

## File Structure

### Files deleted
- `src/utils/actions/wysiwyg.ts` — only contains `autocompleteGemini`, a `"use server"` module.
- `src/components/wysiwyg/custom_extensions/autocomplete.tsx` — only contains the `AutocompleteGemini` Tiptap extension.

### File modified
- `src/components/wysiwyg/Tiptap.tsx` — strip the autocomplete wiring (imports, extension, Tab-key handler, autocomplete-trigger state and effects).

### Files NOT touched
- `src/utils/actions/tag.ts` — `validateTag()` still uses Gemini.
- `package.json`, `package-lock.json` — `@google/generative-ai` still required by `tag.ts`.
- `.env`, `.env.example`, `.env.local.example` — `GOOGLE_AI_KEY` still required by `tag.ts`.
- `docs/CONCERNS.md` — referenced in the issue body, does not exist in repo. Not creating.
- All other files.

---

## Task 1: Delete the autocomplete server action

**Files:**
- Delete: `src/utils/actions/wysiwyg.ts`

- [ ] **Step 1: Delete the file**

Run from repo root:

```bash
git rm src/utils/actions/wysiwyg.ts
```

Expected: `git status` shows `D  src/utils/actions/wysiwyg.ts`. No other output.

- [ ] **Step 2: Verify no other file imports from it**

Run:

```bash
grep -rn "from \"@/utils/actions/wysiwyg\"" src
grep -rn "from '@/utils/actions/wysiwyg'" src
```

Expected: no matches. (Only `wysiwyg.ts` itself imported it; nothing else should.)

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0. The next task edits the importer, so an error here is OK if it's the `Tiptap.tsx` import — that's expected to break until Task 2.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(wysiwyg): delete autocompleteGemini server action (#7)"
```

---

## Task 2: Delete the AutocompleteGemini Tiptap extension

**Files:**
- Delete: `src/components/wysiwyg/custom_extensions/autocomplete.tsx`

- [ ] **Step 1: Delete the file**

Run from repo root:

```bash
git rm src/components/wysiwyg/custom_extensions/autocomplete.tsx
```

Expected: `git status` shows `D  src/components/wysiwyg/custom_extensions/autocomplete.tsx`.

- [ ] **Step 2: Verify the directory still has its sibling**

Run:

```bash
ls src/components/wysiwyg/custom_extensions/
```

Expected output:

```
Image.tsx
```

(The `custom_extensions/` directory stays because `Image.tsx` lives there.)

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(wysiwyg): delete AutocompleteGemini Tiptap extension (#7)"
```

---

## Task 3: Strip autocomplete wiring from `src/components/wysiwyg/Tiptap.tsx`

**Files:**
- Modify: `src/components/wysiwyg/Tiptap.tsx`

This is the only behavioral change. Remove every line that exists solely to feed or drive the autocomplete. Tiptap keeps `Placeholder`, `Image`, `Link`, `Youtube`. The title and description editors are untouched. The save/publish flow is untouched.

- [ ] **Step 1: Drop the two autocomplete imports (lines 17–18)**

In `src/components/wysiwyg/Tiptap.tsx`, delete these two lines:

```ts
import { autocompleteGemini } from "@/utils/actions/wysiwyg";
import { AutocompleteGemini } from "./custom_extensions/autocomplete";
```

Expected: the surrounding import block keeps `validateTag` from `@/utils/actions/tag` and `tiptapExtensions` from `@/utils/tiptapExt`. Order is preserved.

- [ ] **Step 2: Drop the autocomplete-trigger state and ref (lines 88–90)**

Delete the `useState` for `insertContentState`, the `useRef` for `insertContentTimeout`, and the destructure line:

```ts
const [insertContentState, setInsertContentState] =
    useState<boolean>(false);
const insertContentTimeout = useRef<NodeJS.Timeout>(undefined);
```

Expected: nothing else in the file references `insertContentState`, `setInsertContentState`, `insertContentTimeout`, or `clearTimeout(insertContentTimeout.current)` after later steps.

- [ ] **Step 3: Drop `AutocompleteGemini` from the extensions array (line 98)**

In the `useEditor` extensions array, delete the line `AutocompleteGemini,`. The remaining entries (`...extensions`, `Placeholder`, `TiptapImage.configure(...)`, `TiptapLink.extend(...)`, `Youtube.configure(...)`) stay in the same order.

- [ ] **Step 4: Drop the `editorProps.handleKeyDown` block (lines 110–120)**

In the `useEditor` options, delete the entire `editorProps.handleKeyDown(view, event) {...}` block:

```ts
handleKeyDown(view, event) {
    if (event.key === "Tab") {
        if (!insertContentState) {
            event.preventDefault();
            setInsertContentState(true);
        }
    } else {
        clearTimeout(insertContentTimeout.current);
        setInsertContentState(false);
    }
},
```

The surrounding object — `content: (editOrDraft?.content as JSONContent) ?? "",` above and `},` to close `editorProps` below — stays. Result: `editorProps` becomes `{ attributes: { ... } }`.

- [ ] **Step 5: Drop `insertContentRef` and its `useEffect` (lines 129–148)**

Delete the `insertContentRef` declaration and the `useEffect` that writes to it:

```ts
const insertContentRef = useRef<(_words: string) => Promise<void>>(
    async (_words: string) => {},
);
useEffect(() => {
    insertContentRef.current = async (words: string) => {
        const ed = editorRef.current;
        if (!ed) return;
        ed.extensionStorage.AutocompleteExtension.autosuggestion =
            '<span class="generating"><span>&#x2022;</span><span>&#x2022;</span><span>&#x2022;</span></span>';
        ed.commands.setMeta("triggerSuggestion", true);
        const autocomplete = await autocompleteGemini(words);
        if (autocomplete) {
            ed.extensionStorage.AutocompleteExtension.autosuggestion =
                autocomplete;
        } else {
            ed.extensionStorage.AutocompleteExtension.autosuggestion = "";
        }
        ed.commands.setMeta("triggerSuggestion", false);
    };
});
```

Expected: nothing else in the file references `insertContentRef`.

- [ ] **Step 6: Drop the debounced-trigger `useEffect` (lines 150–161)**

Delete this block:

```ts
useEffect(() => {
    if (!insertContentState) return;
    const ed = editorRef.current;
    if (!ed) return;
    const prompt = ed.getText();
    if (!prompt) return;
    const timeoutId = setTimeout(async () => {
        setInsertContentState(false);
        await insertContentRef.current(prompt);
    }, 1000);
    return () => clearTimeout(timeoutId);
}, [insertContentState]);
```

- [ ] **Step 7: Verify the file no longer references any autocomplete identifier**

Run:

```bash
grep -n "autocompleteGemini\|AutocompleteGemini\|insertContentState\|insertContentTimeout\|insertContentRef\|triggerSuggestion\|AutocompleteExtension\|autosuggestion" src/components/wysiwyg/Tiptap.tsx
```

Expected: no matches.

- [ ] **Step 8: Run the AGENTS.md pre-completion checklist**

Run both commands. Both must exit 0.

```bash
npx eslint .
npx tsc --noEmit
```

Expected: exit 0 for both. If ESLint flags unused imports that this task didn't catch (e.g., `useRef` is still used elsewhere), leave them — they're out of scope. Only fix errors directly caused by this deletion.

- [ ] **Step 9: Commit**

```bash
git add src/components/wysiwyg/Tiptap.tsx
git commit -m "chore(wysiwyg): strip autocomplete wiring from Tiptap editor (#7)"
```

---

## Task 4: Manual smoke verification in a browser

**Files:** none

This is the regression check for the AGENTS.md "no regressions in the editor's other features" acceptance criterion.

- [ ] **Step 1: Start the dev server with dev-login enabled**

From repo root:

```bash
npm run db:seed
ENABLE_DEV_LOGIN=true npm run dev
```

Wait for "Ready" in stdout.

- [ ] **Step 2: Log in as alice and open the editor**

Run:

```bash
curl -X POST http://localhost:3000/api/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@test.com"}'
```

Expected response shape: `{"url":"http://localhost:3000/api/auth/callback/nodemailer?..."}`. Navigate a browser to that URL. Then visit `http://localhost:3000/new`.

- [ ] **Step 3: Verify no autocomplete UI**

Type a sentence into the body editor and pause for 2+ seconds. Expected:

- No faded span suggesting continuation appears at the cursor.
- No `autocomplete-suggestion` class anywhere in the editor body.
- No `[dev-login] issued token` errors or `autocompleteGemini` references in the server stdout.

- [ ] **Step 4: Verify Tab moves focus natively**

Click into the body editor. Press Tab once. Expected: focus moves to the next focusable element on the page (browser-native Tab behavior). It does NOT stay inside the editor, no suggestion is inserted, and no console error fires.

- [ ] **Step 5: Verify other editor features still work**

- Upload a cover image (the form posts to Cloudinary; with no Cloudinary creds it'll surface an error toast — that's pre-existing and out of scope).
- Type a tag into the tags input — it accepts and renders as a chip.
- Type in the title editor — `editorTitle` updates and `aria-label="Post title"` is on the prose region.
- Type in the description editor — `editorDescription` updates and `aria-label="Post description"` is on the prose region.
- Refresh `/new` and confirm the autosave did not crash.

Expected: no `Uncaught` errors in the browser console. Server stdout has no `autocomplete`/`Gemini` references.

- [ ] **Step 6: Verify published post still renders**

Trigger a full publish (only if Cloudinary creds are configured — otherwise stop at Step 5). After publishing, navigate to the new post URL. Expected: title, description, cover image, and body render. The published page has no Gemini/AI artifacts.

- [ ] **Step 7: Stop the dev server**

```bash
# Ctrl-C in the dev server terminal
```

---

## Task 5: Push branch and open the PR

**Files:** none (git operations only)

- [ ] **Step 1: Confirm clean tree and recent commits**

```bash
git status
git log --oneline main..HEAD
```

Expected: clean working tree; three commits on the branch:

1. `chore(wysiwyg): delete autocompleteGemini server action (#7)`
2. `chore(wysiwyg): delete AutocompleteGemini Tiptap extension (#7)`
3. `chore(wysiwyg): strip autocomplete wiring from Tiptap editor (#7)`

(plus the `docs(spec): ...` commit if the branch includes it — split off into its own branch if needed)

- [ ] **Step 2: Push the branch**

```bash
git push -u origin chore/issue-7-remove-gemini-autocomplete
```

Expected: branch pushed, tracking set.

- [ ] **Step 3: Open the PR**

Use `gh`:

```bash
gh pr create \
  --base main \
  --head chore/issue-7-remove-gemini-autocomplete \
  --title "chore(wysiwyg): remove Gemini autocomplete (#7)" \
  --body "$(cat <<'EOF'
Closes #7.

Removes the Gemini-powered autocomplete feature from the WYSIWYG post editor. The platform is moving away from AI-generated content, so the feature ships no more.

Deleted:
- src/utils/actions/wysiwyg.ts — autocompleteGemini server action
- src/components/wysiwyg/custom_extensions/autocomplete.tsx — AutocompleteGemini Tiptap extension

Edited:
- src/components/wysiwyg/Tiptap.tsx — dropped the two imports, the AutocompleteGemini extension entry, the autocomplete-trigger state/refs, the insertContentRef effect, the debounced-trigger effect, and the editorProps.handleKeyDown Tab handler (which would have silently swallowed Tab after the autocomplete was gone).

Out of scope (intentionally untouched):
- src/utils/actions/tag.ts validateTag() still uses GoogleGenerativeAI — separate issue.
- @google/generative-ai dependency and GOOGLE_AI_KEY env var — still required by tag validation.

Verified:
- npx eslint . exits 0
- npx tsc --noEmit exits 0
- /new editor loads, body editor accepts input, Tab moves focus natively, no autocomplete UI appears, autosave + image upload + tag input + publish flow all unchanged.
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 4: Post the URL**

Report the PR URL back. Stop here.