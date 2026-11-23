import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { findOAuthClient } from "@/modules/oauth/clients";
import { matchesRedirectUri } from "@/modules/oauth/redirect-uri";
import { isScopeSubset, parseScopes } from "@/modules/oauth/scopes";
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

    const client = clientId ? await findOAuthClient(clientId) : null;
    const scopes = parseScopes(scope);

    const failure = consentFailure({
        client,
        userId: session.user.id,
        redirectUri,
        codeChallengeMethod,
        codeChallenge,
        scopes,
    });
    if (failure || !client) {
        return (
            <main className="mx-auto w-full max-w-xl p-6">
                <div className="rounded-box border border-hairline bg-surface p-5 elev-1">
                    <h1 className="text-xl font-semibold">
                        This authorization request cannot be granted
                    </h1>
                    <p className="mt-2 text-sm opacity-80">{failure}</p>
                </div>
            </main>
        );
    }

    return (
        <ConsentForm
            clientName={client.name}
            scopes={scopes}
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

function consentFailure(input: {
    client: Awaited<ReturnType<typeof findOAuthClient>>;
    userId: string;
    redirectUri: string;
    codeChallengeMethod: string;
    codeChallenge: string;
    scopes: string[];
}): string | null {
    if (!input.client || input.client.revokedAt) {
        return "This client is not registered.";
    }
    if (input.client.userId !== input.userId) {
        return "This client belongs to another account.";
    }
    if (!matchesRedirectUri(input.client.redirectUris, input.redirectUri)) {
        return "The redirect URI is not registered for this client.";
    }
    if (input.codeChallengeMethod !== "S256" || !input.codeChallenge) {
        return "The request does not use a PKCE S256 challenge.";
    }
    if (!isScopeSubset(input.scopes, input.client.scopes)) {
        return "The request asks for a scope this client does not have.";
    }
    return null;
}
