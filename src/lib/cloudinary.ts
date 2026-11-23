import { cloudinarySignature } from "@/utils/cloudinarySignature";

type ResourceType = "image" | "raw";
type DeliveryType = "upload" | "private";

const CLOUD_NAME = () => process.env.NEXT_CLOUDINARY_NAME as string;
const API_KEY = () => process.env.NEXT_CLOUDINARY_API as string;
const API_SECRET = () => process.env.NEXT_CLOUDINARY_SECRET as string;

export async function uploadCloudinary(options: {
    file: FormDataEntryValue;
    folder: string;
    public_id: string;
    format?: "jpg" | "png";
    resourceType?: ResourceType;
    /** `private` assets are reachable only through a signed URL. */
    type?: DeliveryType;
}) {
    const timestamp = new Date().getTime();
    const resourceType = options.resourceType ?? "image";
    const type = options.type ?? "upload";
    const folder = `postdevfy/${options.folder}`;

    const params: Record<string, string> = {
        folder,
        public_id: options.public_id,
        timestamp: timestamp.toString(),
    };
    // A raw asset keeps its own extension; `format` is an image-only concept.
    if (resourceType === "image") params.format = options.format ?? "jpg";
    if (type !== "upload") params.type = type;

    const formData = new FormData();
    formData.append("file", options.file);
    formData.append("api_key", API_KEY());
    for (const [key, value] of Object.entries(params)) {
        formData.append(key, value);
    }
    formData.append("signature", cloudinarySignature(params, API_SECRET()));

    const upload = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${resourceType}/upload`,
        {
            method: "POST",
            body: formData,
        },
    );
    return {
        upload,
        metadata: {
            timestamp,
            folder,
            public_id: options.public_id,
            resourceType,
            type,
        },
    };
}

export function getCloudinaryImage(options: {
    timestamp: number;
    public_id: string;
    folder: string;
}) {
    const image = `https://res.cloudinary.com/leindfraust/image/upload/v${options.timestamp}/${options.folder}/${options.public_id}.jpg`;
    return image;
}

/**
 * A time-limited URL for a private asset. Cloudinary answers it as an
 * authenticated API request, so the asset itself never becomes public.
 */
export function getPrivateDownloadUrl(options: {
    /** the public_id the upload used, without the folder */
    public_id: string;
    /** the folder including the `postdevfy/` prefix */
    folder: string;
    format: string;
    /** unix seconds */
    expiresAt: number;
}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
        expires_at: options.expiresAt.toString(),
        format: options.format,
        public_id: `${options.folder}/${options.public_id}`,
        timestamp,
        type: "private",
    };

    const url = new URL(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/raw/download`,
    );
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    url.searchParams.set("signature", cloudinarySignature(params, API_SECRET()));
    url.searchParams.set("api_key", API_KEY());
    return url.toString();
}

/** Destroys a stored asset so a removed resume is really gone. */
export async function destroyCloudinaryAsset(options: {
    public_id: string;
    folder: string;
    resourceType?: ResourceType;
    type?: DeliveryType;
}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
        public_id: `${options.folder}/${options.public_id}`,
        timestamp,
        type: options.type ?? "private",
    };

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME()}/${options.resourceType ?? "raw"}/destroy`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...params,
                signature: cloudinarySignature(params, API_SECRET()),
                api_key: API_KEY(),
            }),
        },
    );
    return response.ok;
}
