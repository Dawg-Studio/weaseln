import { expect, it } from "vitest";
import { PROFILE_SECTIONS } from "@/modules/profile-customization/types";
import { RENDERED_SECTIONS } from "../sections";

it("has a renderer for every profile section", () => {
    expect([...RENDERED_SECTIONS].sort()).toEqual([...PROFILE_SECTIONS].sort());
});
