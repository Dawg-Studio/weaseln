import { describe, expect, it } from "vitest";
import { POST_BACKGROUNDS, POST_IMAGE_FITS, POST_PATTERNS } from "./types";
import { BUNDLED_BACKGROUND_IMAGES } from "./visuals";
import {
    DEFAULT_POST_CUSTOMIZATION,
    isDefaultPostCustomization,
    normalizePostCustomization,
    validatePostCustomizationInput,
} from "./validation";

/**
 * Control characters are assembled from their code points rather than typed as
 * literals, so this file itself stays free of raw control bytes — a literal NUL
 * or ESC is invisible in review and mangled by editors and diff tools.
 */
const ctrl = (code: number) => String.fromCharCode(code);

const CLOUDINARY_URL =
    "https://res.cloudinary.com/demo/image/upload/v1/post-bg.jpg";

/**
 * Every one of these must throw. The charset allowlist and the prefix allowlist
 * are two independent gates, and the table exercises both: a `data:` URL clears
 * the charset check and dies on the prefix, while `javascript:alert(1)` dies on
 * the charset check first.
 */
const REJECTED_IMAGE_URLS: { label: string; url: string }[] = [
    { label: "a data: URL", url: "data:image/svg+xml;base64,PHN2Zy8+" },
    { label: "a javascript: URL", url: "javascript:alert(1)" },
    { label: "a protocol-relative //evil.tld URL", url: "//evil.tld/bg.png" },
    { label: "an http:// URL on another host", url: "http://evil.tld/bg.png" },
    {
        label: "an https:// URL on another host",
        url: "https://evil.tld/bg.png",
    },
    {
        label: "a URL longer than 2048 characters",
        url: `/covers/${"a".repeat(2048)}.svg`,
    },
    { label: "a URL containing a double quote", url: '/covers/co"ver.svg' },
    { label: "a URL containing a single quote", url: "/covers/co'ver.svg" },
    {
        label: "a URL containing an open parenthesis",
        url: "/covers/co(ver.svg",
    },
    {
        label: "a URL containing a close parenthesis",
        url: "/covers/co)ver.svg",
    },
    { label: "a URL containing a backslash", url: "/covers/co\\ver.svg" },
    { label: "a URL containing a space", url: "/covers/co ver.svg" },
    {
        label: "a URL containing a NUL control character",
        url: `/covers/co${ctrl(0)}ver.svg`,
    },
    {
        label: "a URL containing a newline control character",
        url: `/covers/co${ctrl(10)}ver.svg`,
    },
    {
        label: "a URL containing a carriage return control character",
        url: `/covers/co${ctrl(13)}ver.svg`,
    },
    {
        label: "a URL containing an ESC control character",
        url: `/covers/co${ctrl(27)}ver.svg`,
    },
    {
        label: "a URL containing a DEL control character",
        url: `/covers/co${ctrl(127)}ver.svg`,
    },
];

describe("validatePostCustomizationInput", () => {
    it("accepts every palette slug in the closed vocabulary", () => {
        for (const slug of POST_BACKGROUNDS) {
            const result = validatePostCustomizationInput({
                backgroundColor: slug,
            });
            expect(result.backgroundColor).toBe(slug);
        }
    });

    it("accepts every pattern in the closed vocabulary", () => {
        for (const pattern of POST_PATTERNS) {
            const result = validatePostCustomizationInput({
                backgroundPattern: pattern,
            });
            expect(result.backgroundPattern).toBe(pattern);
        }
    });

    it("accepts every image fit in the closed vocabulary", () => {
        for (const fit of POST_IMAGE_FITS) {
            const result = validatePostCustomizationInput({
                backgroundFit: fit,
            });
            expect(result.backgroundFit).toBe(fit);
        }
    });

    it("rejects an unknown palette slug", () => {
        expect(() =>
            validatePostCustomizationInput({ backgroundColor: "neon" }),
        ).toThrow();
        // A post stores a SLUG, never a CSS colour, so the free-form hex the
        // profile module accepts must be refused here.
        expect(() =>
            validatePostCustomizationInput({ backgroundColor: "#ff00ff" }),
        ).toThrow();
        expect(() =>
            validatePostCustomizationInput({ backgroundColor: 7 }),
        ).toThrow();
    });

    it("rejects an unknown pattern and an unknown fit", () => {
        expect(() =>
            validatePostCustomizationInput({ backgroundPattern: "stripes" }),
        ).toThrow();
        expect(() =>
            validatePostCustomizationInput({ backgroundFit: "contain" }),
        ).toThrow();
    });

    it("rejects a payload that is not a plain object", () => {
        expect(() => validatePostCustomizationInput(null)).toThrow();
        expect(() => validatePostCustomizationInput(undefined)).toThrow();
        expect(() => validatePostCustomizationInput("clay")).toThrow();
        expect(() => validatePostCustomizationInput(42)).toThrow();
        expect(() => validatePostCustomizationInput(["clay"])).toThrow();
    });

    it("fills a partial payload from the defaults", () => {
        expect(validatePostCustomizationInput({})).toEqual(
            DEFAULT_POST_CUSTOMIZATION,
        );
        expect(
            validatePostCustomizationInput({ backgroundColor: "moss" }),
        ).toEqual({
            ...DEFAULT_POST_CUSTOMIZATION,
            backgroundColor: "moss",
        });
        expect(
            validatePostCustomizationInput({ backgroundPattern: "hatch" }),
        ).toEqual({
            ...DEFAULT_POST_CUSTOMIZATION,
            backgroundPattern: "hatch",
        });
    });

    it("accepts a bundled /covers/ image and a Cloudinary image", () => {
        expect(
            validatePostCustomizationInput({
                backgroundImage: "/covers/cover-1.svg",
            }).backgroundImage,
        ).toBe("/covers/cover-1.svg");

        expect(
            validatePostCustomizationInput({
                backgroundImage: CLOUDINARY_URL,
            }).backgroundImage,
        ).toBe(CLOUDINARY_URL);
    });

    it("accepts every image the composer picker offers", () => {
        // Guards against the drift where `visuals.ts` offers a URL that
        // `validation.ts` would refuse to store.
        for (const image of BUNDLED_BACKGROUND_IMAGES) {
            expect(
                validatePostCustomizationInput({ backgroundImage: image.url })
                    .backgroundImage,
            ).toBe(image.url);
        }
    });

    it("treats a null or omitted image as the no-image sentinel", () => {
        expect(
            validatePostCustomizationInput({ backgroundImage: null })
                .backgroundImage,
        ).toBeNull();
        expect(
            validatePostCustomizationInput({ backgroundColor: "clay" })
                .backgroundImage,
        ).toBeNull();
    });

    it.each(REJECTED_IMAGE_URLS)("rejects $label", ({ url }) => {
        expect(() =>
            validatePostCustomizationInput({ backgroundImage: url }),
        ).toThrow();
    });

    it("rejects an empty or non-string background image", () => {
        expect(() =>
            validatePostCustomizationInput({ backgroundImage: "" }),
        ).toThrow();
        expect(() =>
            validatePostCustomizationInput({ backgroundImage: 12 }),
        ).toThrow();
    });
});

describe("normalizePostCustomization", () => {
    it("never throws, whatever the stored row looks like", () => {
        const hostile: unknown[] = [
            null,
            undefined,
            "clay",
            42,
            true,
            [],
            ["clay", "dots"],
            {},
            { backgroundColor: { nested: true }, backgroundPattern: [] },
            ...REJECTED_IMAGE_URLS.map(({ url }) => ({ backgroundImage: url })),
        ];

        for (const input of hostile) {
            expect(() => normalizePostCustomization(input)).not.toThrow();
        }
    });

    it("returns the defaults for null, undefined, a string and an array", () => {
        expect(normalizePostCustomization(null)).toEqual(
            DEFAULT_POST_CUSTOMIZATION,
        );
        expect(normalizePostCustomization(undefined)).toEqual(
            DEFAULT_POST_CUSTOMIZATION,
        );
        expect(normalizePostCustomization("not-an-object")).toEqual(
            DEFAULT_POST_CUSTOMIZATION,
        );
        expect(normalizePostCustomization(["clay", "dots"])).toEqual(
            DEFAULT_POST_CUSTOMIZATION,
        );
    });

    it("returns a valid row unchanged", () => {
        expect(
            normalizePostCustomization({
                backgroundColor: "dusk",
                backgroundPattern: "grid",
                backgroundImage: CLOUDINARY_URL,
                backgroundFit: "tile",
            }),
        ).toEqual({
            backgroundColor: "dusk",
            backgroundPattern: "grid",
            backgroundImage: CLOUDINARY_URL,
            backgroundFit: "tile",
        });
    });

    it("degrades field by field: a bad image keeps a good colour", () => {
        const result = normalizePostCustomization({
            backgroundColor: "clay",
            backgroundPattern: "dots",
            backgroundImage: "javascript:alert(1)",
            backgroundFit: "cover",
        });

        expect(result.backgroundColor).toBe("clay");
        expect(result.backgroundPattern).toBe("dots");
        expect(result.backgroundImage).toBeNull();
    });

    it("degrades each bad column on its own", () => {
        expect(
            normalizePostCustomization({
                backgroundColor: "chartreuse",
                backgroundPattern: "hatch",
                backgroundImage: "/covers/cover-3.svg",
                backgroundFit: "warp",
            }),
        ).toEqual({
            backgroundColor: "default",
            backgroundPattern: "hatch",
            backgroundImage: "/covers/cover-3.svg",
            backgroundFit: "cover",
        });
    });

    it("ignores the other columns of a Prisma post row", () => {
        expect(
            normalizePostCustomization({
                id: "post-1",
                title: "Hello",
                coverImage: "https://example.com/cover.png",
                backgroundColor: "fern",
                backgroundPattern: "wash",
                backgroundImage: null,
                backgroundFit: "cover",
            }),
        ).toStrictEqual({
            backgroundColor: "fern",
            backgroundPattern: "wash",
            backgroundImage: null,
            backgroundFit: "cover",
        });
    });
});

describe("isDefaultPostCustomization", () => {
    it("is true for the default customization", () => {
        expect(isDefaultPostCustomization(DEFAULT_POST_CUSTOMIZATION)).toBe(
            true,
        );
    });

    it("is false once a colour, pattern or image is set", () => {
        expect(
            isDefaultPostCustomization({
                ...DEFAULT_POST_CUSTOMIZATION,
                backgroundColor: "sand",
            }),
        ).toBe(false);
        expect(
            isDefaultPostCustomization({
                ...DEFAULT_POST_CUSTOMIZATION,
                backgroundPattern: "dots",
            }),
        ).toBe(false);
        expect(
            isDefaultPostCustomization({
                ...DEFAULT_POST_CUSTOMIZATION,
                backgroundImage: "/covers/cover-2.svg",
            }),
        ).toBe(false);
    });

    it("stays true when only the fit differs, because fit alone paints nothing", () => {
        expect(
            isDefaultPostCustomization({
                ...DEFAULT_POST_CUSTOMIZATION,
                backgroundFit: "tile",
            }),
        ).toBe(true);
    });
});
