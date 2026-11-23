import crypto from "crypto";

/**
 * Cloudinary signs the parameters in alphabetical order, then appends the API
 * secret. The order is part of the contract: reordering silently breaks every
 * upload.
 */
export function cloudinarySignature(
    params: Record<string, string>,
    apiSecret: string,
) {
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return crypto
        .createHash("sha1")
        .update(`${payload}${apiSecret}`)
        .digest("hex");
}
