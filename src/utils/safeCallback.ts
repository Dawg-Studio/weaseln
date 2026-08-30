/* callbackUrl arrives on the query string, so it is attacker-controlled. Auth.js
   validates it again before redirecting, but the login page dereferences it first
   for the already-signed-in shortcut, so it has to stand on its own.

   Resolve rather than pattern-match. Prefix checks keep missing variants: the URL
   spec folds a backslash into "/" for http(s), so "/\evil.com" reaches the browser
   as the protocol-relative "//evil.com" and leaves the origin. Parsing against our
   own origin and keeping the value only if it stayed there closes that whole class
   at once, and drops any raw CR/LF/tab on the way through.

   Returns a same-origin relative path, or "/" when the input is missing, absolute
   to somewhere else, or unparseable. */
export function safeCallback(raw?: string) {
    if (!raw) return "/";
    try {
        const origin = new URL(
            process.env.NEXTAUTH_URL || "http://localhost:3000",
        ).origin;
        const url = new URL(raw, origin);
        if (url.origin === origin) return url.pathname + url.search + url.hash;
    } catch {
        /* unparseable base or callback — fall through to the safe default */
    }
    return "/";
}
