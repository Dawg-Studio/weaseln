import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: Vitest 4.x hoists vi.mock() factories above top-level consts, so
// the mocks have to be hoisted with them.
const { findUniqueMock, upsertMock, updateMock } = vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    upsertMock: vi.fn(),
    updateMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    default: {
        userProfileCustomization: {
            findUnique: findUniqueMock,
            upsert: upsertMock,
            update: updateMock,
        },
    },
}));

import {
    getProfileCustomization,
    resetProfileCustomization,
    setProfileCustomization,
} from "./service";
import { DEFAULT_PROFILE_CUSTOMIZATION } from "./validation";

const storedRow = {
    id: "row-1",
    userId: "alice",
    preset: "minimal",
    layout: { variant: "standard", sectionOrder: [], hiddenSections: [] },
    backgroundColor: null,
    backgroundImage: null,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundOverlay: null,
    pageGradient: null,
    cardColor: null,
    cardOpacity: 100,
    cardRadius: "medium",
    cardShadow: "subtle",
    borderStyle: "none",
    textColor: "#111111",
    mutedTextColor: null,
    accentColor: "#222222",
    fontFamily: "system",
    headingSize: "large",
    textAlign: "center",
    spacingDensity: "comfortable",
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe("profile customization service", () => {
    beforeEach(() => {
        findUniqueMock.mockReset();
        upsertMock.mockReset();
        updateMock.mockReset();
        upsertMock.mockResolvedValue(storedRow);
        updateMock.mockResolvedValue(storedRow);
    });

    it("merges a partial input over the stored row", async () => {
        findUniqueMock.mockResolvedValue(storedRow);

        await setProfileCustomization(
            { userId: "alice" },
            { preset: "editorial" },
        );

        const update = upsertMock.mock.calls[0][0].update;
        expect(update.preset).toBe("editorial");
        // The fields the request did not name keep the values they had.
        expect(update.textColor).toBe("#111111");
        expect(update.accentColor).toBe("#222222");
    });

    it("returns the defaults when no row exists", async () => {
        findUniqueMock.mockResolvedValue(null);

        const customization = await getProfileCustomization({
            userId: "alice",
        });

        expect(customization).toEqual(DEFAULT_PROFILE_CUSTOMIZATION);
    });

    it("rejects an invalid field without writing", async () => {
        findUniqueMock.mockResolvedValue(storedRow);

        await expect(
            setProfileCustomization(
                { userId: "alice" },
                { cardOpacity: 500 },
            ),
        ).rejects.toThrow(/cardOpacity/);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it("resets every field to the defaults", async () => {
        await resetProfileCustomization({ userId: "alice" });

        const data = updateMock.mock.calls[0][0].data;
        for (const [field, value] of Object.entries(
            DEFAULT_PROFILE_CUSTOMIZATION,
        )) {
            expect(data[field]).toEqual(value);
        }
    });
});
