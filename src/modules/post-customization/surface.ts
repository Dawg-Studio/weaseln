import type { CSSProperties } from "react";

import type { PostBackground, PostImageFit, PostPattern } from "./types";
import {
    isDefaultPostCustomization,
    normalizePostCustomization,
} from "./validation";

/**
 * The props a customized surface spreads onto its root element. Every one is
 * optional, and an uncustomized post yields an empty object.
 */
export type PostSurfaceProps = {
    "data-post-bg"?: PostBackground;
    "data-post-pattern"?: PostPattern;
    "data-post-fit"?: PostImageFit;
    style?: CSSProperties;
};

/**
 * THE single place a stored customization becomes pixels.
 *
 * `PostCard`, `PostContainer` and the post detail page all spread the result of
 * this function and do nothing else. That is what satisfies "rendered
 * consistently in post cards and post detail views" — the three surfaces cannot
 * drift because there is only one implementation to drift from. (Contrast the
 * profile feature, where `ProfileCustomizationPreview.tsx` keeps a second copy
 * of `UserOrgProfile.tsx`'s class maps, with a comment admitting the risk.)
 *
 * Why data attributes and a CSS custom property rather than the codebase's
 * usual `Record<Union, string>` Tailwind class maps:
 *
 *  - An uncustomized post must be byte-identical to today. Returning `{}` makes
 *    that a mechanical fact. Routing the default through `cn()`/`twMerge`
 *    would make it an assertion about a third-party merge function.
 *  - The tint has to win over `bg-surface` on the card. These rules are
 *    authored unlayered in `globals.css`, and unlayered declarations outrank
 *    anything in Tailwind's `@layer utilities` regardless of specificity — a
 *    class map would have to fight the utility it replaces.
 *  - The value travels through the JSON feed as one short string, and there is
 *    no dynamically-interpolated class name for the Tailwind scanner to miss.
 *
 * Accepts `unknown` because callers hand it a Prisma row directly. Reading is
 * lenient by design: a corrupt column degrades this post to the default
 * appearance instead of throwing inside a feed that renders ten at a time.
 */
export function postSurfaceProps(source: unknown): PostSurfaceProps {
    const customization = normalizePostCustomization(source);

    // The whole of acceptance criterion 4, in one line.
    if (isDefaultPostCustomization(customization)) return {};

    const props: PostSurfaceProps = {};

    if (customization.backgroundColor !== "default") {
        props["data-post-bg"] = customization.backgroundColor;
    }

    // Image and pattern both drive `background-image`, so exactly one wins and
    // the image is it. The precedence lives here rather than in the schema so
    // that clearing an image falls back to whatever pattern was chosen.
    if (customization.backgroundImage) {
        props["data-post-fit"] = customization.backgroundFit;
        // The URL passed validation's prefix allowlist AND its positive charset
        // check, so it cannot contain a quote, paren, backslash, whitespace or
        // control character — there is nothing here to break out of the CSS
        // `url("…")` token.
        props.style = {
            "--post-image": `url("${customization.backgroundImage}")`,
        } as CSSProperties;
    } else if (customization.backgroundPattern !== "none") {
        props["data-post-pattern"] = customization.backgroundPattern;
    }

    return props;
}
