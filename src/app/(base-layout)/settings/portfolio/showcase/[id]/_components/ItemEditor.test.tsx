import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ItemEditor from "./ItemEditor";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const twelveUrls = Array.from(
    { length: 12 },
    (_, i) => `https://res.cloudinary.com/leindfraust/image/upload/v1/p/${i}.jpg`,
);

const item = {
    id: "i1",
    title: "Harbour",
    summary: null,
    description: null,
    coverImage: null,
    gallery: twelveUrls,
    link: null,
    tags: [],
    date: null,
};

describe("ItemEditor", () => {
    it("stops accepting gallery uploads at twelve images", () => {
        render(<ItemEditor showcaseId="s1" item={item} />);
        expect(screen.getByText(/12 of 12/)).toBeInTheDocument();
        expect(screen.getByLabelText(/add gallery image/i)).toBeDisabled();
    });

    it("accepts a gallery upload below the cap", () => {
        render(<ItemEditor showcaseId="s1" item={{ ...item, gallery: [] }} />);
        expect(screen.getByLabelText(/add gallery image/i)).toBeEnabled();
    });
});
