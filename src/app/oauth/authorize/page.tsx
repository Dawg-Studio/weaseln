import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
    findOAuthClient,
    resolveClient,
    type ResolvedClient,
} from "@/modules/oauth/clients";
import { matchesRedirectUri } from "@/modules/oauth/redirect-uri";
import {
    grantedScopes,
    isScopeSubset,
    OAUTH_SCOPES,
    parseScopes,
} from "@/modules/oauth/scopes";
import { signInUrl } from "@/utils/signInUrl";

import ConsentForm from "./_components/ConsentForm";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The consent screen. It is a page and not a route handler because Next
 * forbids a page and a route at the same path, and because the reader gets
 * the site's own layout.
 */
export default async function AuthorizePage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string") query.set(key, value);
    }
    const callbackUrl = `/oauth/authorize${
        query.size ? `?${query.toString()}` : ""
    }`;

    const session = await auth();
    if (!session?.user) redirect(signInUrl(callbackUrl));

    const clientId = query.get("client_id") ?? "";
    const redirectUri = query.get("redirect_uri") ?? "";
    const state = query.get("state") ?? "";
    const scope = query.get("scope") ?? "";
    const codeChallenge = query.get("code_challenge") ?? "";
    const codeChallengeMethod = query.get("code_challenge_method") ?? "";
    const responseType = query.get("response_type") ?? "";

    let client: ResolvedClient | null = null;
    try {
        client = clientId ? await resolveClient(clientId) : null;
    } catch (error) {
        // A URL-shaped client id whose document is unreachable or invalid.
        return (
            <Refusal
                message={
                    error instanceof Error
                        ? error.message
                        : "This client could not be verified."
                }
            />
        );
    }
    if (!client) return <Refusal message="This client is not registered." />;

    const scopes = parseScopes(scope);

    const failure = await consentFailure({
        client,
        userId: session.user.id,
        redirectUri,
        codeChallengeMethod,
        codeChallenge,
        scopes,
        responseType,
    });
    if (failure) return <Refusal message={failure} />;

    return (
        <ConsentForm
            clientName={client.name}
            clientOrigin={client.origin}
            isPublicClient={client.public}
            scopes={grantedScopes(scopes, { public: client.public })}
            request={{
                clientId,
                redirectUri,
                codeChallenge,
                codeChallengeMethod,
                scope,
                state,
            }}
        />
    );
}

function Refusal({ message }: { message: string }) {
    return (
        <main className="mx-auto w-full max-w-xl p-6">
            <div className="rounded-box border border-hairline bg-surface p-5 elev-1">
                <h1 className="text-xl font-semibold">
                    This authorization request cannot be granted
                </h1>
                <p className="mt-2 text-sm opacity-80">{message}</p>
            </div>
        </main>
    );
}

async function consentFailure(input: {
    client: ResolvedClient;
    userId: string;
    redirectUri: string;
    codeChallengeMethod: string;
    codeChallenge: string;
    scopes: string[];
    responseType: string;
}): Promise<string | null> {
    if (input.responseType !== "code") {
        return "This server only supports the authorization code flow.";
    }
    // A registered client may only be authorized by the account that owns it. A
    // metadata client has no owner; the consent screen binds it to the consenter.
    if (!input.client.public) {
        const registered = await findOAuthClient(input.client.clientId);
        if (!registered || registered.revokedAt) {
            return "This client is not registered.";
        }
        if (registered.userId !== input.userId) {
            return "This client belongs to another account.";
        }
    }
    if (!matchesRedirectUri(input.client.redirectUris, input.redirectUri)) {
        return "The redirect URI is not registered for this client.";
    }
    if (input.codeChallengeMethod !== "S256" || !input.codeChallenge) {
        return "The request does not use a PKCE S256 challenge.";
    }
    const scopeAllowed = input.client.allowedScopes
        ? isScopeSubset(input.scopes, input.client.allowedScopes)
        : input.scopes.every((scope) =>
              (OAUTH_SCOPES as readonly string[]).includes(scope),
          );
    if (!scopeAllowed) {
        return "The request asks for a scope this client does not have.";
    }
    return null;
}
