export const OAUTH_SCOPES = [
    "posts:read",
    "posts:write",
    "org:read",
    "org:write",
    "design:read",
    "design:write",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export function parseScopes(value: string | undefined): string[] {
    return (value ?? "")
        .split(" ")
        .map((scope) => scope.trim())
        .filter(Boolean);
}

/**
 * A client may only ask for scopes it was registered with, so a token can
 * never carry a capability the credential was not granted.
 */
export function isScopeSubset(
    requested: string[],
    allowed: string[],
): boolean {
    return requested.every((scope) => allowed.includes(scope));
}
