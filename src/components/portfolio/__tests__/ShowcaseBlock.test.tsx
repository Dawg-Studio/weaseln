import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ShowcaseBlock from "../ShowcaseBlock";

const items = [
    {
        id: "i1",
        slug: "a",
        title: "Harbour",
        summary: "Dusk",
        description: null,
        coverImage: null,
        gallery: ["https://res.cloudinary.com/x/1.jpg"],
        link: null,
        tags: [],
        date: "2024",
    },
];

describe("ShowcaseBlock", () => {
    it("renders a gallery layout as images", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Photography", description: null, layout: "gallery", slug: "photography" }}
                items={items}
            />,
        );
        expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
        expect(screen.getByRole("heading", { name: "Photography" })).toBeInTheDocument();
    });

    it("renders a list layout with the summary and no images", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Writing", description: null, layout: "list", slug: "writing" }}
                items={items}
            />,
        );
        expect(screen.getByText("Dusk")).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("links each item to its page", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Work", description: null, layout: "grid", slug: "work" }}
                items={items}
            />,
        );
        expect(
            screen.getAllByRole("link", { name: /Harbour/ })[0],
        ).toHaveAttribute("href", "/alice/portfolio/work/a");
    });

    it("renders nothing when the showcase has no items", () => {
        const { container } = render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Empty", description: null, layout: "grid", slug: "empty" }}
                items={[]}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("links the heading to the showcase page when a title href is given", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Work", description: null, layout: "grid", slug: "work" }}
                items={items}
                titleHref="/alice/portfolio/work"
            />,
        );
        expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/alice/portfolio/work");
    });

    it("leaves the heading a plain heading without a title href", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Work", description: null, layout: "grid", slug: "work" }}
                items={items}
            />,
        );
        expect(screen.queryByRole("link", { name: "Work" })).toBeNull();
    });

    it("renders a timeline in descending date order with undated items last", () => {
        render(
            <ShowcaseBlock
                userId="alice"
                showcase={{ title: "Milestones", description: null, layout: "timeline", slug: "milestones" }}
                items={[
                    { ...items[0], id: "old", slug: "old", title: "Older", date: "2019" },
                    { ...items[0], id: "none", slug: "none", title: "Undated", date: null },
                    { ...items[0], id: "new", slug: "new", title: "Newer", date: "2024" },
                ]}
            />,
        );
        const titles = screen.getAllByRole("link").map((link) => link.textContent);
        expect(titles[0]).toContain("Newer");
        expect(titles[1]).toContain("Older");
        expect(titles[2]).toContain("Undated");
    });
});
