import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUploadForm from "@/components/wysiwyg/ImageUploadForm";

describe("ImageUploadForm", () => {
    it("renders an upload label and triggers onUpload when a file is selected", async () => {
        const onUpload = vi.fn();
        const user = userEvent.setup();
        render(<ImageUploadForm onUpload={onUpload} />);

        expect(
            screen.getByText(/add cover image/i),
        ).toBeInTheDocument();

        const file = new File(["hello"], "cover.png", { type: "image/png" });
        const input = document.getElementById(
            "coverImage",
        ) as HTMLInputElement;
        await user.upload(input, file);

        expect(onUpload).toHaveBeenCalledTimes(1);
        expect(onUpload.mock.calls[0]?.[0]).toMatch(/^blob:/);
    });
});
