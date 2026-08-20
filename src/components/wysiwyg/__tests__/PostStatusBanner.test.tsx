import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PostStatusBanner from "@/components/wysiwyg/PostStatusBanner";
import { StatusResponse } from "@/types/status";

describe("PostStatusBanner", () => {
    it("renders nothing when postError is null", () => {
        const { container } = render(<PostStatusBanner postError={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the error message when postError is provided", () => {
        const error: StatusResponse = {
            ok: false,
            status: 500,
            statusText: "Server Error",
            message: "Something went wrong, please try again later.",
        };
        render(<PostStatusBanner postError={error} />);
        expect(screen.getByText(error.message)).toBeInTheDocument();
    });
});
