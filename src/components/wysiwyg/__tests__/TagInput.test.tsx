import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagInput from "@/components/wysiwyg/TagInput";

describe("TagInput", () => {
    it("renders existing tags and calls onChange when a tag is added", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <TagInput
                value={["existing"]}
                onChange={onChange}
                tagList={["newtag"]}
            />,
        );

        expect(screen.getByText("#existing")).toBeInTheDocument();

        const newTag = screen.getByText("newtag");
        await user.click(newTag);

        expect(onChange).toHaveBeenCalledWith(["existing", "newtag"]);
    });

    it("renders Up to N tags text", () => {
        render(<TagInput value={[]} onChange={() => {}} maxTags={4} />);
        expect(screen.getByText(/up to 4 tags only/i)).toBeInTheDocument();
    });
});
