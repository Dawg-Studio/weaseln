import { toast } from "react-hot-toast";

/**
 * A request whose failure the owner has to hear about.
 *
 * Returns the response when the request succeeded and `null` when it did
 * not - the request never completed, or the server refused. A caller that
 * gets `null` stops, instead of carrying on as if the write had landed.
 */
export async function requestOrToast(
    input: string,
    init: RequestInit,
    message: string,
): Promise<Response | null> {
    try {
        const response = await fetch(input, init);
        if (!response.ok) {
            toast.error(message);
            return null;
        }
        return response;
    } catch {
        toast.error(message);
        return null;
    }
}
