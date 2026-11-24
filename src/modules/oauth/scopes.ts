export const OAUTH_SCOPES = [
    "posts:read",
    "posts:write",
    "org:read",
    "org:write",
    "design:read",
    "design:write",
    "profile:read",
    "profile:write",
    "portfolio:read",
    "portfolio:write",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

/**
 * What each scope grants, for the places that have to name a permission in
 * prose. The `Record` over the scope union means a new scope cannot be
 * added without a line here.
 */
export const OAUTH_SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
    "posts:read": "read posts",
    "posts:write": "create, update, publish and delete posts",
    "org:read": "read organizations and their members",
    "org:write": "create organizations and manage their members",
    "design:read": "read the profile and post design",
    "design:write": "change the profile and post design",
    "profile:read": "read the profile text: name, bio, links, skills",
    "profile:write": "change the profile text",
    "portfolio:read": "read the resume, experience and showcases",
    "portfolio:write": "upload and delete the resume, manage projects",
};

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
