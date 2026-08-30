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

### `/icons/weaslnnobg.png` — transparent variant

1536×1024 export of the same artwork on a transparent (alpha) field. Use this
version anywhere the cream background of the opaque logo would box badly:
navbar, Auth.js sign-in page (`src/auth.ts` theme logo), and email templates
(48×32 at its natural 3:2 aspect). All references in code point here.

### `/icons/weasln.png` — the source logo (opaque)

The real logo ships as a 1448×1086 PNG (opaque cream field, weasel artwork
centered in the middle ~55% of the frame). It backs the PWA icons, favicon,
and the cover watermarks (which reference `/icons/weasln.png` directly):

Keep the source file safe; it is the editable master for any future redraw.
Do not scale it below a 24px height in UI chrome.

### Retired vector marks

`public/weaseln.svg` (badge), `public/weaseln-text-with-logo.svg` (lockup) and
`public/weaseln-bg.svg` (OG canvas) were removed with the login redesign — they
were hand-drawn simplifications that had drifted from `/icons/weasln.png`, and
nothing referenced them any more. Use the rasters below instead. The wordmark
`public/weaseln-text.svg` is unaffected and still ships.

Clear-space and minimum-size rules still apply to the raster mark: keep at least
20% of the mark's width free on all sides, and never render below 24px in UI
chrome. Do not recolor the fur; monochrome is allowed for low-opacity watermarks.

### Wordmark

`public/weaseln-text.svg` — the wordmark on its own. Set in a bold, rounded
sans stack (`Inter` → `Segoe UI` → system-ui), weight 800, tight tracking. The
full-stop is rendered in `--rust` — it is the one permitted accent.

### Social / Open Graph image

`public/weaseln.png` — 1024×1024 opaque square, referenced by
`src/app/layout.tsx` `metadata.openGraph.images` with explicit width/height/alt.
A square is the right shape here because the Twitter card is `summary`, and a
raster is required at all: most social scrapers will not render an SVG, which is
one reason the old 1200×630 `weaseln-bg.svg` was retired.

## Favicon and PWA icons

- `src/app/favicon.ico` — 32×32, center-cropped from the logo.
- `public/icons/192.png`, `384.png`, `512.png` — center-square crops of the
  logo filling the maskable safe zone; referenced by `src/app/manifest.json`
  (`purpose: "any maskable"` for 192).
- `public/weaseln.png` — 1024×1024 square crop of the logo (print/social fallback).
- `public/weasln.png` — the original 1448×1086 source shipped by the brand owner.

PWA `theme_color` and `background_color` are `#FBF8F0`.

## Default post covers

`public/covers/cover-1..4.svg` (1920×1080, `preserveAspectRatio="xMidYMid slice"`):

1. **Dawn Dash** — cream-to-tan sky, sun motif, layered ridges, motion swooshes.
2. **Ember Trail** — deep coffee-night field, radial rust glow, concentric rings.
3. **Amber Grid** — tan field, faint on-brand grid, cream diagonal band.
4. **Ridge Run** — stacked earth layers with a horizon sweep.

Shared language across the set: the badge watermark (bottom-right, scale ≈ .52,
opacity ≈ .16), the palette-only gradients, and a sparse field of cream/tan dots.
Keep these invariants when adding `cover-5`.

## Deriving rasters from source

PWA icons, favicon, and the master raster are cropped from the source PNG
(`/icons/weasln.png`), never from screenshots:

```powershell
$env:NODE_PATH="G:\weaseln\node_modules"
node -e "const sharp=require('sharp'); const p='public/icons/weasln.png'; sharp(p).metadata().then(m=>{const s=Math.min(m.width,m.height); const l=Math.floor((m.width-s)/2),t=Math.floor((m.height-s)/2); sharp(p).extract({left:l,top:t,width:s,height:s}).resize(512,512).png().toFile('public/icons/512.png')})"
```

The favicon `.ico` is the 32×32 PNG wrapped in a single-entry ICO container
(width/height bytes must equal the actual size, not 0).

## Checking in new art

Run `npx eslint .` and `npx tsc --noEmit` and confirm both are clean, then do a
dev-server smoke check that `/weaseln.png`, `/weaseln-text.svg`, the icons, and
all four covers return 200 with no console 404s.