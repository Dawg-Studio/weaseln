/**
 * The origin the request arrived on. The MCP endpoint derives its resource
 * from the request URL, so the URL a user copies has to be the host they
 * are actually on: on a preview deployment that is not the configured
 * production host, and a client pointed at the wrong host fails every call.
 */
export function originFrom(headers: Headers): string {
    const host =
        headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        headers.get("host");
    if (!host) return "";

    // Next builds its own request URL from this header, so the scheme has to
    // be read the same way or the copy and the server disagree.
    const proto = headers.get("x-forwarded-proto")?.includes("https")
        ? "https"
        : "http";
    return `${proto}://${host}`;
}
