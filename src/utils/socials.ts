import type { FormSocials } from "@/types/user";

/**
 * The profile form owns three social fields and sends the whole list back.
 * A link that came from somewhere else - a parsed resume, for instance - is
 * not one of those three, so it has to be carried over or the next profile
 * save deletes it.
 */
export function mergeProfileSocials(
    existing: FormSocials[] | null | undefined,
    formValues: FormSocials[],
): FormSocials[] {
    const owned = new Set(formValues.map((entry) => entry.name));
    const kept = (existing ?? []).filter((entry) => !owned.has(entry.name));
    return [...formValues, ...kept];
}
