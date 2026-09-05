import { safeCallback } from "./safeCallback";

/* Keep page-level auth guards explicit while preserving where the reader was
   headed. Auth.js validates this callback, stores it for the provider flow, and
   then forwards it to the custom /login page. */
export function signInUrl(callbackUrl: string) {
    const query = new URLSearchParams({
        callbackUrl: safeCallback(callbackUrl),
    });
    return `/api/auth/signin?${query.toString()}`;
}
