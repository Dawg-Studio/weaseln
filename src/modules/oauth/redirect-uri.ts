const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function parse(url: string): URL | null {
    try {
        return new URL(url);
    } catch {
        return null;
    }
}

function isLoopback(url: URL): boolean {
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * A redirect URI has to match what the client registered. The one exception
 * is a loopback URI, where the port may change because a native client picks
 * an ephemeral one: RFC 8252 lets the path match and the port differ. Every
 * other URI has to match exactly, so a registered URI is never a prefix of
 * the URI that is allowed.
 */
export function matchesRedirectUri(
    registered: string[],
    candidate: string,
): boolean {
    return registered.some((entry) => {
        if (entry === candidate) return true;

        const registeredUrl = parse(entry);
        const candidateUrl = parse(candidate);
        if (!registeredUrl || !candidateUrl) return false;
        if (!isLoopback(registeredUrl) || !isLoopback(candidateUrl)) {
            return false;
        }
        return (
            registeredUrl.pathname === candidateUrl.pathname &&
            registeredUrl.search === candidateUrl.search
        );
    });
}
