# ZeFer minimal theme + light/dark toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken DaisyUI theme (default to white, support opt-in dark) with a minimal neutral palette and a navbar toggle.

**Architecture:** CSS-only theme tokens (`@plugin "daisyui/theme"` overrides for `light` and `dark`); explicit `data-theme="light"` on `<html>` plus an inline no-flash script that reads `localStorage.theme`; one toggle button in the navbar that uses `theme-change`'s `data-set-theme` attribute. No React theme context.

**Tech Stack:** Next.js 16.3 App Router, Tailwind v4.3, DaisyUI v5.7, `theme-change` v2.5 (already installed), `@fortawesome/free-solid-svg-icons` (already installed), vitest + @testing-library/react (jsdom).

## Global Constraints

- **Tailwind v4 + DaisyUI v5**: no `tailwind.config.js`. Themes are declared inside `globals.css` via `@plugin "daisyui/theme" { name: ...; ... }`. All theme variables use OKLCH. (Source: `package.json`, `globals.css`.)
- **Default theme on cold load MUST be `light`**, regardless of OS `prefers-color-scheme`. Achieved by setting `data-theme="light"` on `<html>` and removing `--prefersdark` from the dark theme.
- **No new dependencies.** Use `faSun` and `faMoon` from `@fortawesome/free-solid-svg-icons` (already in `package.json`).
- **No new components.** The toggle lives inline in `Navigation.tsx` — a `ThemeToggleButton` subcomponent inside the same file is fine; a new file is not.
- **No system-preference auto-switching.** The user is on light by default; switching is explicit.
- **`localStorage` key is `"theme"`.** Value is `"light"` or `"dark"`. The `theme-change` library owns writes; the inline bootstrap script only reads.
- **Pre-completion gates (per `AGENTS.md`):** both `npx eslint .` and `npx tsc --noEmit` must exit 0 before declaring a task done. Running only one is insufficient.
- **Accessibility:** every interactive control needs an accessible name. The toggle button gets `aria-label` that describes what it WILL do (not its current state) — `Switch to dark theme` when on light, `Switch to light theme` when on dark.
- **Mobile-first:** the toggle button is visible at every breakpoint; navbar otherwise behaves as today (hamburger appears below `lg`).
- **Commit style:** one commit per task. Format: `feat(theme): <task summary>` or `fix(theme): <task summary>`. Don't amend prior commits.

---

## File Structure

| File | Role | Touched in |
|---|---|---|
| `src/app/globals.css` | Theme tokens (light + dark overrides) | Task 1 |
| `src/app/layout.tsx` | `data-theme="light"` default + no-flash inline script | Task 2 |
| `src/components/ui/Navigation.tsx` | Theme toggle button (with `ThemeToggleButton` subcomponent) | Task 3 |
| `src/components/ui/__tests__/ThemeToggleButton.test.tsx` | Unit test for the toggle's label/icon/attribute | Task 3 |

No other files. No new dependencies. No new shared components.

---

## Task 1: Replace `globals.css` with neutral light + dark themes

**Files:**
- Modify: `src/app/globals.css` (full replacement, 56 → ~80 lines)

**Interfaces:**
- Produces: two DaisyUI themes named `light` (default) and `dark` (manual). Both use OKLCH, both use `--depth: 0`, `--noise: 0`, and the same `--radius-*` values listed below.
- Consumes: nothing (this is the foundation).

**Theme variables (both themes):**

```
--radius-selector: 0.375rem
--radius-field:    0.5rem
--radius-box:      0.75rem
--size-selector:   0.25rem
--size-field:      0.25rem
--border:          1px
--depth:           0
--noise:           0
```

**Light tokens:**
```
--color-base-100:           oklch(100% 0 0)
--color-base-200:           oklch(98% 0 0)
--color-base-300:           oklch(92% 0 0)
--color-base-content:       oklch(15% 0 0)
--color-primary:            oklch(20% 0 0)
--color-primary-content:    oklch(98% 0 0)
--color-secondary:          oklch(45% 0 0)
--color-secondary-content:  oklch(98% 0 0)
--color-accent:             oklch(55% 0 0)
--color-accent-content:     oklch(98% 0 0)
--color-neutral:            oklch(25% 0 0)
--color-neutral-content:    oklch(98% 0 0)
default: true; prefersdark: false; color-scheme: light
```

**Dark tokens** (mirror image, no chroma):
```
--color-base-100:           oklch(14% 0 0)
--color-base-200:           oklch(18% 0 0)
--color-base-300:           oklch(22% 0 0)
--color-base-content:       oklch(96% 0 0)
--color-primary:            oklch(96% 0 0)
--color-primary-content:    oklch(14% 0 0)
--color-secondary:          oklch(65% 0 0)
--color-secondary-content:  oklch(14% 0 0)
--color-accent:             oklch(75% 0 0)
--color-accent-content:     oklch(14% 0 0)
--color-neutral:            oklch(85% 0 0)
--color-neutral-content:    oklch(14% 0 0)
default: false; prefersdark: false; color-scheme: dark
```

`info` / `success` / `warning` / `error` are **not** overridden — DaisyUI defaults stand.

- [ ] **Step 1: Replace `src/app/globals.css` with the new contents**

Write the file in full (do not edit by accumulation):

```css
@import "tailwindcss";

@plugin "daisyui" {
    themes: light --default, dark;
}

@plugin "daisyui/theme" {
    name: "light";
    default: true;
    prefersdark: false;
    color-scheme: light;

    --color-base-100: oklch(100% 0 0);
    --color-base-200: oklch(98% 0 0);
    --color-base-300: oklch(92% 0 0);
    --color-base-content: oklch(15% 0 0);

    --color-primary: oklch(20% 0 0);
    --color-primary-content: oklch(98% 0 0);

    --color-secondary: oklch(45% 0 0);
    --color-secondary-content: oklch(98% 0 0);

    --color-accent: oklch(55% 0 0);
    --color-accent-content: oklch(98% 0 0);

    --color-neutral: oklch(25% 0 0);
    --color-neutral-content: oklch(98% 0 0);

    --radius-selector: 0.375rem;
    --radius-field: 0.5rem;
    --radius-box: 0.75rem;

    --size-selector: 0.25rem;
    --size-field: 0.25rem;

    --border: 1px;
    --depth: 0;
    --noise: 0;
}

@plugin "daisyui/theme" {
    name: "dark";
    default: false;
    prefersdark: false;
    color-scheme: dark;

    --color-base-100: oklch(14% 0 0);
    --color-base-200: oklch(18% 0 0);
    --color-base-300: oklch(22% 0 0);
    --color-base-content: oklch(96% 0 0);

    --color-primary: oklch(96% 0 0);
    --color-primary-content: oklch(14% 0 0);

    --color-secondary: oklch(65% 0 0);
    --color-secondary-content: oklch(14% 0 0);

    --color-accent: oklch(75% 0 0);
    --color-accent-content: oklch(14% 0 0);

    --color-neutral: oklch(85% 0 0);
    --color-neutral-content: oklch(14% 0 0);

    --radius-selector: 0.375rem;
    --radius-field: 0.5rem;
    --radius-box: 0.75rem;

    --size-selector: 0.25rem;
    --size-field: 0.25rem;

    --border: 1px;
    --depth: 0;
    --noise: 0;
}

@plugin "@tailwindcss/typography";
```

- [ ] **Step 2: Verify in browser**

1. The dev server is already running on `localhost:3000`. Reload `/`.
2. Use the `chrome-devtools` tools to take a fresh screenshot. Save to `.tmp/theme-light.png`.
3. Open DevTools → Elements → `<html>` → confirm `data-theme` attribute is set (it should be — the `<html>` already carries it from the default; the script in Task 2 enforces it). If `data-theme` is missing or wrong, the screenshot will show a dark or off-color page.
4. Expected screenshot: white background, near-black text, near-black "Login" button, near-black navbar background. If the page is dark or has a purple button, the CSS didn't take — check `globals.css` for typos.

- [ ] **Step 3: Run lint + typecheck**

```bash
npx eslint . && npx tsc --noEmit
```

Both must exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): replace daisyUI themes with neutral light/dark overrides"
```

---

## Task 2: Default `<html>` to `data-theme="light"` + no-flash bootstrap

**Files:**
- Modify: `src/app/layout.tsx` (two small additions)

**Interfaces:**
- Consumes: the two themes registered in Task 1.
- Produces: `<html lang="en" data-theme="light" suppressHydrationWarning>` and an inline `<head>` script that runs before paint and copies `localStorage.theme` to `document.documentElement.dataset.theme` if it's `"light"` or `"dark"`.

- [ ] **Step 1: Update the `<html>` element in `src/app/layout.tsx`**

Change line 101 from:

```tsx
<html lang="en">
```

to:

```tsx
<html lang="en" data-theme="light" suppressHydrationWarning>
```

- [ ] **Step 2: Add the inline no-flash script immediately after `<body ...>` opens (still inside `<body>`)**

In `RootLayout`, just below the opening `<body>` tag (and before `<ThemeProvider />` is fine — the script runs synchronously regardless of position, but keeping it the first child of `<body>` is the conventional placement), add:

```tsx
<script
    dangerouslySetInnerHTML={{
        __html:
            "(function(){try{var t=localStorage.getItem('theme');" +
            "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);" +
            "}catch(e){}})()",
    }}
/>
```

The script:
- Wraps everything in an IIFE so it can't leak globals.
- Wraps the `localStorage` access in `try/catch` — Safari private mode throws on access.
- Only sets `data-theme` if the stored value is exactly `"light"` or `"dark"` — guards against corruption or a partial write.

- [ ] **Step 3: Verify in browser**

1. Reload `/`. Confirm page is still light (white background). Take screenshot, save to `.tmp/theme-light-with-default.png`. Compare visually with the Task 1 screenshot — they should match.
2. Open DevTools → Application → Local Storage → `http://localhost:3000`. Add a key `theme` with value `dark`. Reload `/`.
3. Expected: page is now dark (near-black background, near-white text). The transition should NOT flash — it should be dark from first paint.
4. Remove the `theme` key. Reload. Expected: back to light.

- [ ] **Step 4: Run lint + typecheck**

```bash
npx eslint . && npx tsc --noEmit
```

Both must exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(theme): default <html> to data-theme=light + no-flash bootstrap"
```

---

## Task 3: Theme toggle button in the navbar

**Files:**
- Modify: `src/components/ui/Navigation.tsx` (add a `ThemeToggleButton` client subcomponent + render it twice — once in the logged-in branch, once in the anonymous branch)
- Create: `src/components/ui/__tests__/ThemeToggleButton.test.tsx`

**Interfaces:**
- Consumes:
  - `theme-change` v2.5: clicking any element with a `data-set-theme="<name>"` attribute flips `<html data-theme>` to `<name>` and writes `localStorage.setItem('theme', '<name>')`.
  - `document.documentElement.dataset.theme` — read-only source of truth for the current theme (already populated by Task 2 + `theme-change`).
- Produces:
  - `ThemeToggleButton` — a default-exported React component, client-side, that mirrors `<html data-theme>` into React state via a `MutationObserver` on `<html>` and renders a `<button data-set-theme=...>` whose target is the *opposite* of the current theme.
  - The button is rendered in both navbar branches (logged-in and anonymous) of `Navigation.tsx`.

- [ ] **Step 1: Write the failing unit test**

Create `src/components/ui/__tests__/ThemeToggleButton.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ThemeToggleButton from "../Navigation";

describe("ThemeToggleButton", () => {
    beforeEach(() => {
        cleanup();
        document.documentElement.dataset.theme = "light";
    });

    it("renders a button with the dark-mode switch label when current theme is light", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        expect(
            screen.getByRole("button", { name: /switch to dark theme/i }),
        ).toBeInTheDocument();
    });

    it("renders a button with the light-mode switch label when current theme is dark", () => {
        document.documentElement.dataset.theme = "dark";
        render(<ThemeToggleButton />);
        expect(
            screen.getByRole("button", { name: /switch to light theme/i }),
        ).toBeInTheDocument();
    });

    it("sets data-set-theme to the opposite of the current theme", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        const btn = screen.getByRole("button", { name: /switch to dark theme/i });
        expect(btn.dataset.setTheme).toBe("dark");

        cleanup();
        document.documentElement.dataset.theme = "dark";
        render(<ThemeToggleButton />);
        const btn2 = screen.getByRole("button", { name: /switch to light theme/i });
        expect(btn2.dataset.setTheme).toBe("light");
    });

    it("calls theme-change when clicked (smoke — does not throw)", () => {
        document.documentElement.dataset.theme = "light";
        render(<ThemeToggleButton />);
        const btn = screen.getByRole("button", { name: /switch to dark theme/i });
        expect(() => fireEvent.click(btn)).not.toThrow();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/ui/__tests__/ThemeToggleButton.test.tsx
```

Expected: FAIL — module `../Navigation` exists but doesn't export `ThemeToggleButton` as a default.

- [ ] **Step 3: Add `ThemeToggleButton` to `src/components/ui/Navigation.tsx`**

Open `src/components/ui/Navigation.tsx`. Make these changes:

1. Add to the existing import from `@fortawesome/free-solid-svg-icons`:

   ```tsx
   import { faBars, faBell, faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
   ```

2. Add `useState` to the existing React import line:

   ```tsx
   import { useEffect, useState } from "react";
   ```

3. Append a new default-exported component at the **bottom** of the file:

   ```tsx
   export function ThemeToggleButton() {
       const [theme, setTheme] = useState<"light" | "dark">("light");

       useEffect(() => {
           const read = () => {
               const current = document.documentElement.dataset.theme;
               if (current === "light" || current === "dark") setTheme(current);
           };
           read();
           const obs = new MutationObserver(read);
           obs.observe(document.documentElement, {
               attributes: true,
               attributeFilter: ["data-theme"],
           });
           return () => obs.disconnect();
       }, []);

       const next = theme === "dark" ? "light" : "dark";
       const label =
           theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

       return (
           <button
               type="button"
               aria-label={label}
               data-set-theme={next}
               className="btn btn-ghost btn-square"
           >
               <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} />
           </button>
       );
   }
   ```

   Important: declare as `export function ThemeToggleButton()` (named export only) — the file already has a `export default function Navigation(...)` and a second default export would not compile.

   Change the test file's import from:
   ```tsx
   import ThemeToggleButton from "../Navigation";
   ```
   to:
   ```tsx
   import { ThemeToggleButton } from "../Navigation";
   ```

   And in `Navigation.tsx`, declare the toggle as `export function ThemeToggleButton()` (no `export default` line).

4. In `Navigation`'s logged-in branch (the block gated by `name && image && id`), insert the toggle just before the existing notifications dropdown (i.e. as the first child of the `<div className="flex-none">` that wraps the bell, Create Post, and avatar):

   ```tsx
   <div className="flex-none flex items-center gap-1">
       <ThemeToggleButton />
       <div className="dropdown dropdown-end mr-2">
           <Link
               href={"/notifications"}
               className="btn relative"
               onClick={() => refetch()}
           >
               <FontAwesomeIcon icon={faBell} size="xl" />
           </Link>
           {/* ...existing badge... */}
       </div>
       {/* ...Create Post... ...avatar... */}
   </div>
   ```

   Adjust the existing `<div className="flex-none">` wrapper to use `flex items-center gap-1` so the toggle sits flush with the bell. Do NOT wrap the bell/Create Post/avatar in a different element — keep them as siblings.

5. In the anonymous branch (`<div className="flex-none">` containing the Login button), insert the toggle just before the Login button:

   ```tsx
   <div className="flex-none flex items-center gap-1">
       <ThemeToggleButton />
       <div className="dropdown dropdown-end">
           <button className="btn btn-primary" onClick={() => signIn()}>
               Login
           </button>
       </div>
   </div>
   ```

- [ ] **Step 4: Re-run the test to verify it passes**

```bash
npx vitest run src/components/ui/__tests__/ThemeToggleButton.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Verify in browser**

1. Reload `/` cold (clear localStorage first via DevTools).
2. Take screenshot, save to `.tmp/theme-toggle-light.png`. Expected: navbar shows sun icon (the moon shows on light to indicate "switch to dark") — wait, on light the toggle shows the **moon** icon because it advertises the action ("click to go dark"). The label says "Switch to dark theme".
3. Click the toggle. Page goes dark. Icon becomes sun. Label becomes "Switch to light theme".
4. Take screenshot, save to `.tmp/theme-toggle-dark.png`. Verify navbar background is near-black, text is near-white.
5. Reload the page (still in dark via localStorage). Expected: page is dark from first paint — no flash.
6. Click the toggle again. Back to light. Reload. Still light. No flash.
7. Resize browser to 375×812. Take screenshot, save to `.tmp/theme-toggle-mobile.png`. Expected: navbar collapses to hamburger + logo + toggle + Login. Toggle is still visible. Side drawer still works.
8. Navigate to `/new` (post composer, if logged in). If anonymous, log in first via `/api/dev-login` (dev only). Take screenshot. Expected: Tiptap editor still renders correctly under the new theme tokens.

- [ ] **Step 6: Run lint + typecheck**

```bash
npx eslint . && npx tsc --noEmit
```

Both must exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Navigation.tsx src/components/ui/__tests__/ThemeToggleButton.test.tsx
git commit -m "feat(theme): add navbar toggle button (sun/moon) with MutationObserver mirror"
```

---

## Done

After all three tasks land and `npx eslint .` + `npx tsc --noEmit` exit 0, the spec's verification list (`docs/superpowers/specs/2026-08-18-zefer-minimal-theme-design.md` §Verification) is fully covered:

1. ✅ Cold load `/` → white background, black logo text, near-black "Login" — covered by Task 1 + Task 2.
2. ✅ Cold load with OS in dark preference → still white (explicit `data-theme="light"` wins) — covered by Task 2 step 3.
3. ✅ Click moon → dark, sun icon appears, reload → still dark — covered by Task 3 step 5.
4. ✅ Click sun → light, reload → still light — covered by Task 3 step 5.
5. ✅ Mobile 375×812 — covered by Task 3 step 5.
6. ✅ `/new` composer still renders — covered by Task 3 step 5.
7. ✅ ESLint exit 0 — checked in each task.
8. ✅ `tsc --noEmit` exit 0 — checked in each task.
