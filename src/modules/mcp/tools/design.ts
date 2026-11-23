import { requireScopes, type McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { uploadImage, type ImagePurpose } from "@/modules/images/service";
import {
    POST_BACKGROUNDS,
    POST_IMAGE_FITS,
    POST_PATTERNS,
} from "@/modules/post-customization/types";
import { validatePostCustomizationInput } from "@/modules/post-customization/validation";
import {
    getProfileCustomization,
    setProfileCustomization,
} from "@/modules/profile-customization/service";
import { DEFAULT_PROFILE_CUSTOMIZATION } from "@/modules/profile-customization/validation";
import { getPost, setPostCustomization } from "@/modules/posts/service";
import type { ProfileCustomizationInput } from "@/modules/profile-customization/validation";

import {
    callerOf,
    text,
    toolError,
    type ScopeChallengeHandler,
    type ToolContext,
} from "./shared";

const profileDesignSchema = z.object({
    preset: z.string().optional(),
    layout: z.record(z.string(), z.unknown()).optional(),
    backgroundColor: z.string().nullable().optional(),
    backgroundImage: z.string().nullable().optional(),
    backgroundSize: z.string().optional(),
    backgroundPosition: z.string().optional(),
    backgroundOverlay: z.string().nullable().optional(),
    pageGradient: z.string().nullable().optional(),
    cardColor: z.string().nullable().optional(),
    cardOpacity: z.number().optional(),
    cardRadius: z.string().optional(),
    cardShadow: z.string().optional(),
    borderStyle: z.string().optional(),
    textColor: z.string().nullable().optional(),
    mutedTextColor: z.string().nullable().optional(),
    accentColor: z.string().nullable().optional(),
    fontFamily: z.string().optional(),
    headingSize: z.string().optional(),
    textAlign: z.string().optional(),
    spacingDensity: z.string().optional(),
});

type GetProfileDesignArgs = Record<string, never>;

type SetProfileDesignArgs = z.infer<typeof profileDesignSchema>;

type SetPostDesignArgs = {
    postId: string;
    backgroundColor?: string;
    backgroundPattern?: string;
    backgroundImage?: string;
    backgroundFit?: string;
};

type UploadImageArgs = {
    data: string;
    filename?: string;
    purpose: ImagePurpose;
};

export async function handleGetProfileDesign(
    _args: GetProfileDesignArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const design = await getProfileCustomization({
            userId: caller.userId,
        });
        return text({ data: design });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleSetProfileDesign(
    args: SetProfileDesignArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        const design = await setProfileCustomization(
            { userId: caller.userId },
            args as unknown as ProfileCustomizationInput,
        );
        return text({ data: design });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleResetProfileDesign(
    _args: Record<string, never>,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        // The reset has to name every field, because the write merges over
        // the stored row: an empty input would change nothing.
        const design = await setProfileCustomization(
            { userId: caller.userId },
            { ...DEFAULT_PROFILE_CUSTOMIZATION },
        );
        return text({ data: design });
    } catch (error) {
        return toolError(error);
    }
}

export async function handleSetPostDesign(
    args: SetPostDesignArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        await getPost({ userId: caller.userId }, { postId: args.postId });
        const customization = validatePostCustomizationInput({
            ...(args.backgroundColor !== undefined && {
                backgroundColor: args.backgroundColor,
            }),
            ...(args.backgroundPattern !== undefined && {
                backgroundPattern: args.backgroundPattern,
            }),
            ...(args.backgroundImage !== undefined && {
                backgroundImage: args.backgroundImage,
            }),
            ...(args.backgroundFit !== undefined && {
                backgroundFit: args.backgroundFit,
            }),
        });
        await setPostCustomization(
            { userId: caller.userId },
            { postId: args.postId, customization },
        );
        return text({ data: customization });
    } catch (error) {
        return toolError(error);
    }
}

export const uploadImageScopeChallenge: ScopeChallengeHandler = ({
    authInfo,
}) => {
    const scopes = authInfo?.scopes ?? [];
    const required = [
        "posts:write",
        "org:write",
        "design:write",
        "portfolio:write",
        "profile:write",
    ];
    if (required.some((scope) => scopes.includes(scope))) return undefined;
    return {
        scopes: required as [string, ...string[]],
        errorDescription:
            "This tool needs one of posts:write, org:write, design:write, portfolio:write or profile:write.",
    };
};

export async function handleUploadImage(
    args: UploadImageArgs,
    ctx: ToolContext,
) {
    try {
        const caller = callerOf(ctx);
        // The image service owns the size cap, and the base64 it carries
        // fits inside the MCP body cap.
        const { url } = await uploadImage(
            { userId: caller.userId },
            {
                data: args.data,
                filename: args.filename,
                purpose: args.purpose,
            },
        );
        return text({ url });
    } catch (error) {
        return toolError(error);
    }
}

export function registerDesignTools(server: McpServer) {
    server.registerTool(
        "get_profile_design",
        {
            description:
                "Read the profile design of this account: preset, layout, colours, fonts and spacing.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("design:read"),
        },
        handleGetProfileDesign,
    );

    server.registerTool(
        "set_profile_design",
        {
            description:
                "Change the profile design of this account. Only the fields you name change.",
            inputSchema: profileDesignSchema,
            scopeChallenge: requireScopes("design:write"),
        },
        handleSetProfileDesign,
    );

    server.registerTool(
        "reset_profile_design",
        {
            description: "Put the profile design of this account back to its defaults.",
            inputSchema: z.object({}),
            scopeChallenge: requireScopes("design:write"),
        },
        handleResetProfileDesign,
    );

    server.registerTool(
        "set_post_design",
        {
            description:
                "Change the background of one of this account's posts.",
            inputSchema: z.object({
                postId: z.string(),
                backgroundColor: z
                    .string()
                    .optional()
                    .describe(`One of: ${POST_BACKGROUNDS.join(", ")}`),
                backgroundPattern: z
                    .string()
                    .optional()
                    .describe(`One of: ${POST_PATTERNS.join(", ")}`),
                backgroundImage: z
                    .string()
                    .optional()
                    .describe("An uploaded image URL"),
                backgroundFit: z
                    .string()
                    .optional()
                    .describe(`One of: ${POST_IMAGE_FITS.join(", ")}`),
            }),
            scopeChallenge: requireScopes("design:write"),
        },
        handleSetPostDesign,
    );

    server.registerTool(
        "upload_image",
        {
            description:
                "Upload an image and get the URL to use as a cover or a background.",
            inputSchema: z.object({
                data: z
                    .string()
                    .describe("The image as base64, without a data URL prefix"),
                filename: z.string().optional(),
                purpose: z.enum([
                    "cover",
                    "post_background",
                    "profile",
                    "organization",
                    "portfolio",
                ]),
            }),
            scopeChallenge: uploadImageScopeChallenge,
        },
        handleUploadImage,
    );
}
