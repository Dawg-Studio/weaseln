import { describe, expect, it } from "vitest";
import { postSurfaceProps, type PostSurfaceProps } from "./surface";
import { DEFAULT_POST_CUSTOMIZATION } from "./validation";

/**
 * `--post-image` is a CSS custom property, and `CSSProperties` has no index
 * signature for one, so reading it back in a test needs a widening cast. The
 * production code casts in the same direction for the same reason.
 */
function postImage(props: PostSurfaceProps): string | undefined {
    const style = props.style as Record<string, string | undefined> | undefined;
    return style?.["--post-image"];
}

/** The shape a Prisma `Post` row hands `postSurfaceProps`. */
function postRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "post-1",
        title: "A post",
        coverImage: null,
        ...DEFAULT_POST_CUSTOMIZATION,
        ...overrides,
    };
}

describe("postSurfaceProps", () => {
    // Acceptance criterion 4 — "posts without customization retain the current
    // default appearance". An empty object is what makes that mechanical: the
    // renderers spread it and emit literally nothing, so an uncustomized post
    // is byte-identical to a pre-feature one.
    it("returns an empty object for a default row", () => {
        const props = postSurfaceProps(postRow());
        expect(props).toStrictEqual({});
        expect(Object.keys(props)).toHaveLength(0);
    });

    it("returns an empty object for null and undefined", () => {
        expect(postSurfaceProps(null)).toStrictEqual({});
        expect(postSurfaceProps(undefined)).toStrictEqual({});
    });

    it("returns an empty object for a corrupt row", () => {
        // A row hand-edited in the database, or left behind by a partial
        // migration, degrades to the default appearance instead of throwing
        // inside a feed that renders ten posts at a time.
        const corrupt = postSurfaceProps({
            backgroundColor: "chartreuse",
            backgroundPattern: "explode",
            backgroundImage: "javascript:alert(1)",
            backgroundFit: 42,
        });
        expect(corrupt).toStrictEqual({});
        expect(Object.keys(corrupt)).toHaveLength(0);

        expect(postSurfaceProps("not-an-object")).toStrictEqual({});
        expect(postSurfaceProps(["clay", "dots"])).toStrictEqual({});
        expect(postSurfaceProps(7)).toStrictEqual({});
    });

    it("emits data-post-bg for a palette slug and nothing else", () => {
        expect(
            postSurfaceProps(postRow({ backgroundColor: "clay" })),
        ).toStrictEqual({ "data-post-bg": "clay" });
    });

    it("emits data-post-pattern only when no image is set", () => {
        expect(
            postSurfaceProps(postRow({ backgroundPattern: "dots" })),
        ).toStrictEqual({ "data-post-pattern": "dots" });

        const withColour = postSurfaceProps(
            postRow({ backgroundColor: "fog", backgroundPattern: "hatch" }),
        );
        expect(withColour).toStrictEqual({
            "data-post-bg": "fog",
            "data-post-pattern": "hatch",
        });
    });

    it("lets an image win over a pattern and emits the fit plus --post-image", () => {
        const props = postSurfaceProps(
            postRow({
                backgroundColor: "moss",
                backgroundPattern: "grid",
                backgroundImage: "/covers/cover-2.svg",
                backgroundFit: "tile",
            }),
        );

        // Both drive `background-image`, so exactly one may win.
        expect(props["data-post-pattern"]).toBeUndefined();
        expect(props["data-post-bg"]).toBe("moss");
        expect(props["data-post-fit"]).toBe("tile");
        expect(postImage(props)).toBe('url("/covers/cover-2.svg")');
    });

    it("carries the default cover fit through for an image", () => {
        const props = postSurfaceProps(
            postRow({ backgroundImage: "/covers/cover-4.svg" }),
        );
        expect(props["data-post-fit"]).toBe("cover");
        expect(postImage(props)).toBe('url("/covers/cover-4.svg")');
    });

    it("emits a --post-image that cannot break out of the url() token", () => {
        const cloudinary =
            "https://res.cloudinary.com/demo/image/upload/v1/post-bg.jpg";
        const value = postImage(
            postSurfaceProps(postRow({ backgroundImage: cloudinary })),
        );

        expect(value).toBeDefined();
        const inner = /^url\("([^"]*)"\)$/.exec(value ?? "");
        expect(inner).not.toBeNull();

        const url = inner?.[1] ?? "";
        expect(url).toBe(cloudinary);
        // Every character survives validation's positive charset allowlist, so
        // nothing here can terminate the token early.
        expect(url).toMatch(/^[A-Za-z0-9._~:/?#@!$&*+,;=%-]+$/);
        for (const forbidden of ['"', "'", "(", ")", "\\", " "]) {
            expect(url).not.toContain(forbidden);
        }
    });

    it("drops a breakout attempt without discarding the palette slug", () => {
        const props = postSurfaceProps(
            postRow({
                backgroundColor: "dusk",
                backgroundImage:
                    'https://res.cloudinary.com/a.jpg");background:url("javascript:alert(1)',
            }),
        );

        expect(props["data-post-bg"]).toBe("dusk");
        expect(props.style).toBeUndefined();
        expect(props["data-post-fit"]).toBeUndefined();
    });
});
