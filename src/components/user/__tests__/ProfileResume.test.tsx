import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileResume from "../ProfileResume";

const work = {
    kind: "work" as const,
    org: "Dawg Studio",
    role: "Engineer",
    location: null,
    startDate: "2024-01",
    endDate: null,
    isCurrent: true,
    description: null,
};

const education = {
    ...work,
    kind: "education" as const,
    org: "TU Berlin",
    role: "BSc",
};

describe("ProfileResume", () => {
    it("splits work and education into two lists", () => {
        render(
            <ProfileResume
                skills={["TypeScript"]}
                experience={[work, education]}
                downloadUrl={null}
            />,
        );
        expect(
            screen.getByRole("heading", { name: "Work" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Education" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Dawg Studio")).toBeInTheDocument();
        expect(screen.getByText("TU Berlin")).toBeInTheDocument();
    });

    it("renders the skills as chips", () => {
        render(
            <ProfileResume
                skills={["TypeScript", "Prisma"]}
                experience={[]}
                downloadUrl={null}
            />,
        );
        expect(screen.getByText("TypeScript")).toBeInTheDocument();
        expect(screen.getByText("Prisma")).toBeInTheDocument();
    });

    it("links the download when there is one", () => {
        render(
            <ProfileResume
                skills={[]}
                experience={[]}
                downloadUrl="/api/portfolio/resume/download?userId=u1"
            />,
        );
        expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute(
            "href",
            "/api/portfolio/resume/download?userId=u1",
        );
    });

    it("renders nothing when there is no resume at all", () => {
        const { container } = render(
            <ProfileResume skills={[]} experience={[]} downloadUrl={null} />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
