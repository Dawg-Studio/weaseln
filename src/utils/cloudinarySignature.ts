import crypto from "crypto";

const generateSignature = (id: string, apiSecret: string, folder: string, timestamp: number) => {
    return `folder=${folder}&format=jpg&public_id=${id}&timestamp=${timestamp}${apiSecret}`;
};

export default function cloudinarySignature(id: string, apiSecret: string, folder: string, timestamp: number) {
    return crypto.createHash("sha1").update(generateSignature(id, apiSecret, folder, timestamp)).digest("hex");
}