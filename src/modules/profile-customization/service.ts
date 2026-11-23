import prisma from "@/db";
import {
    DEFAULT_PROFILE_CUSTOMIZATION,
    normalizeProfileCustomization,
    validateProfileCustomizationInput,
    type ProfileCustomizationInput,
} from "@/modules/profile-customization/validation";
import type { ProfileCustomization } from "@/modules/profile-customization/types";

export type ProfileActor = { userId: string };

type ProfileCustomizationRow = Awaited<
    ReturnType<typeof prisma.userProfileCustomization.upsert>
>;

/**
 * The customization columns, taken from the defaults so the list cannot drift
 * from the type.
 */
const CUSTOMIZATION_FIELDS = Object.keys(
    DEFAULT_PROFILE_CUSTOMIZATION,
) as (keyof ProfileCustomization)[];

/**
 * The stored row, read the forgiving way: a row written by an older deploy or
 * hand-edited in the database degrades to the default appearance instead of
 * taking down the page that renders it.
 */
function storedCustomization(
    row: ProfileCustomizationRow | null | undefined,
): ProfileCustomization {
    if (!row) return { ...DEFAULT_PROFILE_CUSTOMIZATION };
    const picked: Record<string, unknown> = {};
    for (const field of CUSTOMIZATION_FIELDS) {
        const value = row[field];
        if (value !== undefined) picked[field] = value;
    }
    return normalizeProfileCustomization(picked);
}

function definedInput(
    input: ProfileCustomizationInput,
): ProfileCustomizationInput {
    const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
    );
    return Object.fromEntries(entries) as ProfileCustomizationInput;
}

export async function getProfileCustomization(
    actor: ProfileActor,
): Promise<ProfileCustomization> {
    const row = await prisma.userProfileCustomization.findUnique({
        where: { userId: actor.userId },
    });
    return storedCustomization(row);
}

/**
 * A partial input changes only the fields it names. The validator merges over
 * the defaults, so the write has to be built from the stored row: writing the
 * request on its own would reset every field it did not mention.
 */
export async function setProfileCustomization(
    actor: ProfileActor,
    input: ProfileCustomizationInput,
): Promise<ProfileCustomization> {
    const row = await prisma.userProfileCustomization.findUnique({
        where: { userId: actor.userId },
    });
    const merged = {
        ...storedCustomization(row),
        ...definedInput(input),
    };
    const next = validateProfileCustomizationInput(merged);
    await prisma.userProfileCustomization.upsert({
        where: { userId: actor.userId },
        create: { userId: actor.userId, ...next },
        update: next,
    });
    return next;
}

export async function resetProfileCustomization(
    actor: ProfileActor,
): Promise<ProfileCustomization> {
    await prisma.userProfileCustomization.update({
        where: { userId: actor.userId },
        data: { ...DEFAULT_PROFILE_CUSTOMIZATION },
    });
    return { ...DEFAULT_PROFILE_CUSTOMIZATION };
}
