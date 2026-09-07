/**
 * Per-post visual customization (issue #21).
 *
 * Deliberately a CLOSED vocabulary. The profile analogue
 * (`src/modules/profile-customization`) persists free-form colour strings and
 * resolves them at render time; posts do not, for two reasons:
 *
 *  1. A stored hex is theme-blind. This app flips its ink per `data-theme`
 *     (globals.css declares `--color-base-content` twice), so a colour that
 *     reads at 12:1 in light can invert to unreadable in dark. A slug lets the
 *     stylesheet supply a *pair* of values and keeps contrast a property of the
 *     design system rather than of whatever an author typed.
 *  2. The issue asks for a "supported" background colour. A union type is the
 *     literal encoding of "supported", and it makes the reject-invalid-input
 *     acceptance criterion a membership test instead of a sanitiser.
 *
 * Every value below is authored in git and painted from `globals.css`.
 */

/**
 * Palette slugs. `default` is the no-fill sentinel: a post carrying it renders
 * exactly as posts did before this feature existed.
 *
 * The nine hues sit at one lightness per theme (L=92% light, L=27.5% dark) so
 * body ink clears WCAG AAA on every one of them (worst case 10.67:1 light,
 * 11.86:1 dark) and muted metadata clears AA (worst case 5.60:1 light,
 * 5.87:1 dark). All eighteen values are inside the sRGB gamut.
 */
export const POST_BACKGROUNDS = [
    "default",
    "clay",
    "apricot",
    "sand",
    "moss",
    "fern",
    "fog",
    "slate",
    "dusk",
    "blossom",
] as const;

export type PostBackground = (typeof POST_BACKGROUNDS)[number];

/**
 * Texture overlays. Each is generated in CSS from the existing hairline tokens,
 * so it adapts per theme for free and costs nothing in contrast — there is no
 * raster to download and no URL to validate.
 *
 * `none` is the sentinel.
 */
export const POST_PATTERNS = ["none", "dots", "grid", "hatch", "wash"] as const;

export type PostPattern = (typeof POST_PATTERNS)[number];

/**
 * How a background image is fitted. Only meaningful when `backgroundImage` is
 * set; ignored otherwise.
 */
export const POST_IMAGE_FITS = ["cover", "tile"] as const;

export type PostImageFit = (typeof POST_IMAGE_FITS)[number];

export type PostCustomization = {
    /** A palette slug, never a CSS colour. */
    backgroundColor: PostBackground;
    /** A texture slug. Ignored when `backgroundImage` is set. */
    backgroundPattern: PostPattern;
    /**
     * An allowlisted URL (`/covers/…` or `https://res.cloudinary.com/…`), or
     * null. Takes precedence over `backgroundPattern` — both drive
     * `background-image`, so only one can win.
     */
    backgroundImage: string | null;
    /** Fit for `backgroundImage`. */
    backgroundFit: PostImageFit;
};
