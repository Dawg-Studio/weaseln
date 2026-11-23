import prisma from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import type { FormSocials } from "@/types/user";
import { mergeSocialsByName } from "@/utils/socials";
import { serializable } from "@/utils/serializable";

export type ProfileActor = { userId: string };

export type OwnProfile = {
    username: string;
    name: string | null;
    bio: string | null;
    address: string | null;
    occupation: string | null;
    email: string | null;
    image: string;
    skills: string[];
    socials: FormSocials[];
};

/**
 * The status and the field travel with the error so the route keeps its own
 * 400 and 409 responses without matching on message text, and the settings
 * form can point at the input that was refused.
 */
export class ProfileError extends Error {
    readonly status: number;
    readonly field?: string;

    constructor(message: string, status: number, field?: string) {
        super(message);
        this.name = "ProfileError";
        this.status = status;
        this.field = field;
    }
}

/**
 * The fields a caller may set on their own account. Spreading the request
 * body into Prisma lets a caller write any column, and the profile renders
 * `resumeUrl` as an href - `javascript:` would be a link on a public page.
 * Resume fields and `skills` are written only by the portfolio service.
 */
export const PROFILE_FIELDS = [
    "username",
    "name",
    "bio",
    "address",
    "occupation",
    "email",
    "socials",
    "image",
] as const;

function isSocialList(
    value: unknown,
): value is { name: string; url: string }[] {
    return (
        Array.isArray(value) &&
        value.every(
            (entry) =>
                Boolean(entry) &&
                typeof entry === "object" &&
                typeof (entry as { name?: unknown }).name === "string" &&
                typeof (entry as { url?: unknown }).url === "string",
        )
    );
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
    );
}

/**
 * The column Prisma tripped on is in the error's meta. The input is the
 * fallback: the settings form always sends a username and an email, so the
 * input alone cannot say which one of the two was taken.
 */
function conflictField(
    error: unknown,
    input: Record<string, unknown>,
): "username" | "email" | null {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const named = Array.isArray(target) ? target : [];
    if (named.includes("username")) return "username";
    if (named.includes("email")) return "email";
    if ("username" in input) return "username";
    if ("email" in input) return "email";
    return null;
}

export async function updateOwnProfile(
    actor: ProfileActor,
    input: Record<string, unknown>,
): Promise<OwnProfile> {
    const unsupported = Object.keys(input).find(
        (key) => !(PROFILE_FIELDS as readonly string[]).includes(key),
    );
    if (unsupported !== undefined) {
        throw new ProfileError(`Unsupported field: ${unsupported}`, 400);
    }

    const data = Object.fromEntries(
        PROFILE_FIELDS.filter((field) => field in input).map((field) => [
            field,
            input[field],
        ]),
    ) as Prisma.UserUpdateInput;

    let username: string | undefined;
    if (typeof input.username === "string") {
        username = input.username.replace(/\s/g, "");
        // An empty username breaks the profile's own links, and the column is
        // unique, so the second owner to do it would fail their whole save.
        if (username.length === 0) {
            throw new ProfileError("username must not be empty", 400);
        }
        data.username = username;
    }

    let socials: { name: string; url: string }[] | undefined;
    if (input.socials !== undefined) {
        if (!isSocialList(input.socials)) {
            throw new ProfileError(
                "socials must be a list of { name, url } objects",
                400,
            );
        }
        socials = input.socials;
    }

    try {
        // The merge is a read-then-write, so it runs at the serializable
        // isolation level: two requests that interleave on this row cannot
        // lose a link between them.
        await serializable(async (tx) => {
            if (socials) {
                const current = await tx.user.findUnique({
                    where: { id: actor.userId },
                    select: { socials: true },
                });
                data.socials = mergeSocialsByName(
                    current?.socials,
                    socials,
                ) as Prisma.InputJsonValue[];
            }

            await tx.user.update({
                where: { id: actor.userId },
                data,
            });
        });

        // The posts carry the owner's name and username, and only the fields
        // this request named: a save that changed nothing but the bio must
        // not stamp the account id onto every post the owner has.
        const postData: Prisma.PostUpdateManyMutationInput = {};
        if (typeof input.name === "string") postData.author = input.name;
        if (username !== undefined) postData.authorUsername = username;
        if (Object.keys(postData).length > 0) {
            await prisma.post.updateMany({
                where: { userId: actor.userId },
                data: postData,
            });
        }
    } catch (err) {
        if (isUniqueViolation(err)) {
            const field = conflictField(err, input);
            if (field) {
                throw new ProfileError(
                    field === "username"
                        ? "Username already taken"
                        : "Email already taken",
                    409,
                    field,
                );
            }
        }
        throw err;
    }

    return getOwnProfile(actor);
}

/**
 * The owner's own account text. The experience rows, the resume columns and
 * the download link belong to the portfolio service.
 */
export async function getOwnProfile(actor: ProfileActor): Promise<OwnProfile> {
    const row = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
            username: true,
            name: true,
            bio: true,
            address: true,
            occupation: true,
            email: true,
            image: true,
            skills: true,
            socials: true,
        },
    });

    if (!row) throw new ProfileError("Not authorized", 401);

    return {
        username: row.username,
        name: row.name,
        bio: row.bio,
        address: row.address,
        occupation: row.occupation,
        email: row.email,
        image: row.image,
        skills: row.skills ?? [],
        // The column may be null in the database, and spreading it throws.
        socials: [...(row.socials ?? [])] as FormSocials[],
    };
}
