import { describe, expect, it } from "vitest";
import { originFrom } from "./requestOrigin";

function headersOf(values: Record<string, string>): Headers {
    return new Headers(values);
}

describe("originFrom", () => {
    it("uses the forwarded host and protocol", () => {
        expect(
            originFrom(
                headersOf({
                    "x-forwarded-host": "weaseln.blog",
                    "x-forwarded-proto": "https",
                }),
            ),
        ).toBe("https://weaseln.blog");
    });

    it("falls back to the host header", () => {
        expect(originFrom(headersOf({ host: "localhost:3000" }))).toBe(
            "http://localhost:3000",
        );
    });

    it("takes the first host of a proxy chain", () => {
        expect(
            originFrom(
                headersOf({
                    "x-forwarded-host": "weaseln.blog, internal.local",
                    "x-forwarded-proto": "https",
                }),
            ),
        ).toBe("https://weaseln.blog");
    });

    it("keeps the port the browser asked for", () => {
        expect(
            originFrom(
                headersOf({
                    "x-forwarded-host": "localhost:3000",
                    "x-forwarded-proto": "http",
                }),
            ),
        ).toBe("http://localhost:3000");
    });

    it("answers nothing when the request carries no host", () => {
        expect(originFrom(headersOf({}))).toBe("");
    });
});
