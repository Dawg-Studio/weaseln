# ZeFer minimal theme + light/dark toggle — design

**Status:** approved (brainstorming, 2026-08-18)
**Scope:** DaisyUI v5 + Tailwind v4 styling fix on the Next.js 16.3 App Router.

## Problem

After upgrading DaisyUI, the design broke: the homepage renders dark on load even though the CSS registers `light` as `--default`. The `<html>` element carries no `data-theme`, so DaisyUI falls back to OS preference — and on any user whose OS is dark (or whose browser DevTools is dark), the page is dark. There is no way for the user to flip back to light without changing their OS preference.

A second contributor is the unused custom `mytheme` block in `globals.css` — registered with `default: false`, never invoked. Dead code that confuses future maintainers ("which theme are we on?").

The user wants:
- **White by default**, with a way to switch to dark.
- **Minimal** visual style — neutral palette, no loud brand color.
- **Mobile-responsive** — already largely in place, just verified.

## Approach

Minimum viable patch. Strip the dead theme, force a default on `<html>`, add a one-click toggle, persist the user's choice. Do not introduce a React theme context — DaisyUI's `data-theme` attribute plus the already-installed `theme-change` library already cover the contract.

System-preference auto-switching is intentionally **out of scope**: it reintroduces the original bug (default not honored when OS is dark). GitHub's model — explicit choice, default to light — is the right one.

## Design

### 1. Theme tokens — `src/app/globals.css`

Replace the file's current contents with:

```css
@import "tailwindcss";
@plugin "daisyui" { themes: light --default, dark; }
@plugin "@tailwindcss/typography";

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

  /* info / success / warning / error: keep DaisyUI defaults */

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
```

The `mytheme` block is removed entirely. Both themes are grayscale; no chroma on primary/secondary/accent — that's what makes it "minimal."

### 2. Default + no-flash bootstrap — `src/app/layout.tsx`

- Add `data-theme="light"` and `suppressHydrationWarning` to `<html>`.
- Insert an inline `<script>` in `<head>` that runs **before paint**:

  ```html
  <script dangerouslySetInnerHTML={{ __html:
    "(function(){try{var t=localStorage.getItem('theme');" +
    "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);" +
    "}catch(e){}})()"
  }} />
  ```

  This prevents a dark→light flash for users who saved `dark` in a previous session. No JS framework needed.

- The existing `<ThemeProvider />` (which calls `themeChange(false)` on mount) stays — `theme-change` is what makes `data-set-theme="..."` attributes work and writes to localStorage on toggle.

### 3. Toggle UI — `src/components/ui/Navigation.tsx`

Add one button between the notifications bell (`/notifications`) and the "Create Post" button, for logged-in users, and between the logo and "Login" for anonymous users:

```tsx
const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

useEffect(() => {
  const read = () =>
    setResolvedTheme(
      (document.documentElement.dataset.theme as "light" | "dark") ?? "light",
    );
  read();
  const obs = new MutationObserver(read);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => obs.disconnect();
}, []);
```

Render:

```tsx
<button
  type="button"
  aria-label={
    resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
  }
  data-set-theme={resolvedTheme === "dark" ? "light" : "dark"}
  className="btn btn-ghost btn-square"
>
  <FontAwesomeIcon icon={resolvedTheme === "dark" ? faSun : faMoon} />
</button>
```

The MutationObserver is the only React-side wiring. DaisyUI owns the source of truth via the `data-theme` attribute — we just mirror it into a button label/icon.

Mobile: button stays visible at all breakpoints. Hamburger drawer is unchanged.

### 4. Mobile responsiveness — verification only

Existing responsive classes are correct:
- `Navigation.tsx` hamburger: `lg:hidden`.
- `SearchBar` in nav: `hidden lg:block`; in drawer: `lg:hidden`.
- Homepage 3-column layout: `hidden lg:block w-1/4` for the two side columns, `w-full ml-4 mr-4` for the post list.

No changes needed; just verify at 375px viewport during QA that nothing overflows the navbar.

## Out of scope

- React theme context, `useTheme()` hook, or theme-aware components.
- System-preference auto-switching.
- Per-component re-skinning (`bg-base-100`, `text-base-content`, `btn-primary` already adapt).
- Light/dark image variants for user-uploaded post covers.
- Removing the unused `theme-change` import elsewhere; we still need it.

## Verification

1. Cold load `/` (no localStorage) → white background, near-black text, near-black "Login" button. Take screenshot.
2. Cold load `/` with DevTools set to dark OS preference → still white (the explicit `data-theme="light"` on `<html>` wins).
3. Click moon icon → page goes dark, button icon becomes sun. Reload → still dark (localStorage `"theme" = "dark"`). Take screenshot.
4. Click sun icon → back to light. Reload → still light. Take screenshot.
5. Resize browser to 375×812 → navbar collapses to hamburger + logo + theme toggle + Login (anonymous) or hamburger + logo + bell + theme toggle + Create Post + avatar (logged in). Cards stack vertically. Take screenshot.
6. Open `/new` (Tiptap composer) — confirm editor chrome renders, not just the listing.
7. `npx eslint .` exit 0.
8. `npx tsc --noEmit` exit 0.

## Files touched

| File | Change |
|---|---|
| `src/app/globals.css` | Replace contents with neutral light + dark themes; drop `mytheme`. |
| `src/app/layout.tsx` | Add `data-theme="light"`, `suppressHydrationWarning`, inline no-flash script. |
| `src/components/ui/Navigation.tsx` | Add theme toggle button (logged-in and anonymous branches). |

No other files. No new dependencies. No new components.
