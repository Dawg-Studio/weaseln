"use client";

import { approveAuthorization, denyAuthorization } from "@/utils/actions/oauth";

export default function ConsentForm({
    clientName,
    scopes,
    request,
}: {
    clientName: string;
    scopes: string[];
    request: {
        clientId: string;
        redirectUri: string;
        codeChallenge: string;
        codeChallengeMethod: string;
        scope: string;
        state: string;
    };
}) {
    return (
        <main className="mx-auto w-full max-w-xl p-6">
            <div className="rounded-box border border-hairline bg-surface p-5 elev-1 space-y-5">
                <div className="space-y-2">
                    <h1 className="text-xl font-semibold">
                        Allow {clientName} to use your account?
                    </h1>
                    <p className="text-sm opacity-80">
                        {clientName} is asking to act as you on weaseln. It
                        will only be able to do what the permissions below
                        allow, and you can withdraw access at any time.
                    </p>
                </div>

                <div className="space-y-2">
                    <h2 className="text-sm font-semibold uppercase opacity-70">
                        Permissions
                    </h2>
                    {scopes.length === 0 ? (
                        <p className="text-sm opacity-80">
                            No permissions were requested.
                        </p>
                    ) : (
                        <ul className="list-disc pl-5 text-sm">
                            {scopes.map((scope) => (
                                <li key={scope}>{scope}</li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex gap-3">
                    <form
                        action={approveAuthorization.bind(null, request)}
                        className="flex-1"
                    >
                        <button
                            type="submit"
                            className="btn btn-neutral w-full"
                            aria-label="Allow this client to use your account"
                        >
                            Allow
                        </button>
                    </form>
                    <form
                        action={denyAuthorization.bind(null, request)}
                        className="flex-1"
                    >
                        <button
                            type="submit"
                            className="btn btn-outline w-full"
                            aria-label="Deny this client access to your account"
                        >
                            Deny
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
