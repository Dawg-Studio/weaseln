# Weaseln visual assets

This doc is the source of truth for Weaseln's visual asset system. It defines the
palette, the logo mark, and the rules that keep future artwork consistent.

## Brand concept

**Weaseln** (a portmanteau of "weasel" + "wide web") — a cheeky, quick, low-to-the
ground publishing platform for developers and creatives. The identity leans into
warm, earthy tones inspired by a weasel's coat: cream, amber, and burnt sienna.

## Palette (design tokens)

| Token      | Hex       | Usage                                            |
| ---------- | --------- | ------------------------------------------------ |
| `--cream`  | `#FBF8F0` | Canvases, badges, PWA/app background, theme color |
| `--cream-lift` | `#FDFCF7` | Gradient highlight on the badge |
| `--cream-shade` | `#F3EAD9` | Gradient shadow on the badge |
| `--tan`     | `#DF9F53` | Secondary accents, rings, secondary strokes       |
| `--rust`    | `#B76745` | Primary brand color, weasel fur, CTA orbit        |
| `--rust-soft` | `#C87A4E` | Fur gradient highlight                             |
| `--rust-deep` | `#A9573A` | Fur gradient shadow                                |
| `--ink`     | `#2E2016` | Wordmark, eyes, darkest surfaces                  |
| `--coffee`  | `#59402A` | Body text on cream                                |

Use these hex values directly in SVG; do not re-derive them from screenshots.

## Brand marks

The artwork is one drawing: a serif **W** with a pen nib for its middle stroke,
a rust brush ring around it, an amber sun dot, and an olive branch to the right;
the full logo adds the "Weaseln" wordmark and the tagline *Content for humans,
by humans*.

It ships in three cuts. Which one a slot gets is decided by **how much height
the slot has**, because the wordmark and tagline are baked into the raster and
stop being legible below roughly 90px of lockup height:

| File | What it is | Use it when |
| ---- | ---------- | ----------- |
| `/weaseln.png` | 1448x1086, opaque textured field — the full logo | Roomy brand surfaces: login, Open Graph, Apple startup image |
| `/icons/Weaselnnobg.png` | 1254x1254, transparent — the source emblem, no type | Source for favicon, compact mark, and PWA icon generation |
| `/icons/weaseln-mark.png` | 512x427, transparent palette PNG — the trimmed delivery emblem | Small runtime slots: nav bar, email footer, and Auth.js `theme.logo` |

`weaseln-mark.png` is alpha-trimmed from `Weaselnnobg.png` and resized to 512px
wide. It is not redrawn art, so it stays in register with the favicon source.

It is a **delivery** cut, not a master: it ships as a palette PNG because it
never renders above ~120px, and two consumers — the email footer and Auth.js
`theme.logo` — link it raw with no `next/image` optimisation in front. Re-derive
it from `Weaselnnobg.png`, which stays lossless, rather than upscaling it.

### Never do this

- **Do not put the full logo in small chrome.** At 36px the tagline is a grey
  smear and "Weaseln" is unreadable. This was the bug behind issue #16.
- **Do not put the opaque cut anywhere it overlaps other artwork** — the cream
  field paints a rectangle. Watermarks and any transparent surface want
  `weaseln-mark.png`.
- **Do not recolour the artwork.** The W and the wordmark are inked near-black
  and vanish on dark surfaces; the fix is a cream plate behind the mark
  (`dark:bg-[#FBF8F0]`), as `Navigation.tsx` does. A filter-based
  invert/brightness fix destroys the rust ring, the amber dot and the green
  branch. Flat monochrome is allowed only for low-opacity watermarks.

Clear-space and minimum-size rules apply to every cut: keep at least 20% of the
mark's width free on all sides, and never render below 24px in UI chrome.

### Retired vector marks

`public/weaseln.svg` (badge), `public/weaseln-text-with-logo.svg` (lockup) and
`public/weaseln-bg.svg` (OG canvas) were removed with the login redesign — they
were hand-drawn simplifications that had drifted from the raster artwork, and
nothing referenced them any more. The superseded `/icons/weasln.png`,
`/icons/weaslnnobg.png`, and `/icons/weasln-mark.png` cuts were retired during
the 2026 logo refresh. The wordmark `public/weaseln-text.svg` is unaffected and
still ships.

### Wordmark

`public/weaseln-text.svg` — the wordmark on its own. Set in a bold, rounded
sans stack (`Inter` → `Segoe UI` → system-ui), weight 800, tight tracking. The
full-stop is rendered in `--rust` — it is the one permitted accent.

### Social / Open Graph image

`public/weaseln.png` — 1448×1086 opaque full logo, referenced by
`src/app/layout.tsx` `metadata.openGraph.images` with explicit width/height/alt.
The Twitter card is `summary`, and a raster is required at all: most social
scrapers will not render an SVG, which is one reason the old 1200×630
`weaseln-bg.svg` was retired.

## Favicon and PWA icons

All of these use the emblem from `/icons/Weaselnnobg.png`, never the full logo.
The browser favicon preserves the transparent background; installable PWA icons
place the mark on the cream field so maskable launchers have a safe backdrop.

- `src/app/favicon.ico` — 16/32/48 PNG entries in one ICO container, mark at
  88% of each transparent canvas. Next.js discovers this file automatically.
- `public/icons/192.png` — mark at 62%, the maskable safe zone; referenced by
  `src/app/manifest.json` as `purpose: "any maskable"`.
- `public/icons/384.png`, `512.png` — mark at 72%, `purpose: "any"`.
- `public/weaseln.png` — 1448x1086 opaque full logo, kept for social/print. It
  is the `metadata.openGraph.images` entry and the
  `appleWebApp.startupImage`, both of which have room for the type.

PWA `theme_color` and `background_color` are `#FBF8F0`.

## Default post covers

`public/covers/cover-1..4.svg` (1920×1080, `preserveAspectRatio="xMidYMid slice"`):

1. **Dawn Dash** — cream-to-tan sky, sun motif, layered ridges, motion swooshes.
2. **Ember Trail** — deep coffee-night field, radial rust glow, concentric rings.
3. **Amber Grid** — tan field, faint on-brand grid, cream diagonal band.
4. **Ridge Run** — stacked earth layers with a horizon sweep.

Shared language across the set: the mark as a watermark (bottom-right, at
`x 1500 y 785 / 300x230`, opacity `.16`), the palette-only gradients, and a
sparse field of cream/tan dots. Keep these invariants when adding `cover-5`.

The watermark is **inlined as a `data:` URI**, not an `/icons/...` path. These
covers are served to `next/image` as an `<img>` src, and an SVG rendered as an
image cannot load external resources — a path here renders nothing at all. The
inlined copy is the mark resized to 300px and quantised to a 64-colour palette,
which costs ~10KB per cover and is invisible at 16% opacity.

## Deriving rasters from source

Every compact cut is produced from `/icons/Weaselnnobg.png` by alpha-trimming,
resizing, and compositing — never from screenshots, and never by redrawing. To
refresh the delivery mark, run this from the repo root with sharp resolvable:

```powershell
node -e "const sharp=require('sharp'); sharp('public/icons/Weaselnnobg.png').trim({background:{r:0,g:0,b:0,alpha:0}}).resize({width:512}).png({compressionLevel:9,effort:10,palette:true,colours:256}).toFile('public/icons/weaseln-mark.png')"
```

PWA icons composite the trimmed source onto `#FBF8F0` at the percentages listed
above. The favicon centres it on a transparent canvas. The `.ico` is a
hand-built container: a 6-byte `ICONDIR`, one 16-byte `ICONDIRENTRY` per size,
then the PNG payloads. The width/height bytes in each entry must equal the actual
size, not the 0 sentinel.

## Checking in new art

Run `npx eslint .` and `npx tsc --noEmit` and confirm both are clean, then do a
dev-server smoke check that `/weaseln.png`, `/weaseln-text.svg`,
`/icons/weaseln-mark.png`, the PWA icons and all four covers return 200 with no
console 404s — and look at the nav logo in **both** themes, not just light.
