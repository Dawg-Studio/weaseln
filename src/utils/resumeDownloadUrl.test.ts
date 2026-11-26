import { describe, expect, it } from "vitest";
import { resumeDownloadUrl } from "./resumeDownloadUrl";

const user = {
    id: "u1",
    resumeUrl: "https://res.cloudinary.com/r.pdf",
    resumePublic: false,
};

describe("resumeDownloadUrl", () => {
    it("gives the owner their private resume", () => {
        expect(resumeDownloadUrl(user, true)).toBe(
            "/api/portfolio/resume/download?userId=u1",
        );
    });

    it("gives a stranger nothing when the resume is private", () => {
        expect(resumeDownloadUrl(user, false)).toBeNull();
    });

    it("gives a stranger a public resume", () => {
        expect(resumeDownloadUrl({ ...user, resumePublic: true }, false)).toBe(
            "/api/portfolio/resume/download?userId=u1",
        );
    });

    it("gives nobody a resume that was never uploaded", () => {
        expect(
            resumeDownloadUrl({ ...user, resumeUrl: null }, true),
        ).toBeNull();
    });

    it("escapes the user id", () => {
        expect(resumeDownloadUrl({ ...user, id: "a b/c" }, true)).toBe(
            "/api/portfolio/resume/download?userId=a%20b%2Fc",
        );
    });
});
