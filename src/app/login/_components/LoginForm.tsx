"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faGithub } from "@fortawesome/free-brands-svg-icons";
import {
    faArrowRight,
    faCircleExclamation,
    faRightToBracket,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { EnabledProvider } from "@/auth";
import { FIELD_SKIN } from "@/components/ui/Input";
import { cn } from "@/utils/cn";

/* Presentation only — which providers exist is decided in src/auth.ts and handed
   down as a prop. An id with no entry here still renders, under a capitalised id
   and a generic icon, so registering a provider can never silently fail to show. */
const OAUTH_META: Record<string, { label: string; icon: IconDefinition }> = {
    google: { label: "Google", icon: faGoogle },
    github: { label: "GitHub", icon: faGithub },
};

const metaFor = (id: string) =>
    OAUTH_META[id] ?? {
        label: id.charAt(0).toUpperCase() + id.slice(1),
        icon: faRightToBracket,
    };

/* Auth.js reports failures as an error code on the query string. Only the codes
   a signed-out visitor can actually reach are spelled out; anything else falls
   back, so a new Auth.js code never renders as a raw enum to a reader. */
const ERROR_COPY: Record<string, string> = {
    OAuthAccountNotLinked:
        "That email already exists under a different sign-in method. Use the one you signed up with.",
    OAuthSignin: "We could not start that sign-in. Please try again.",
    OAuthCallback:
        "That provider did not finish signing you in. Please try again.",
    EmailSignin: "We could not send that link. Check the address and try again.",
    EmailCreateAccount: "We could not create an account for that address.",
    CredentialsSignin: "Those details did not match an account.",
    Verification: "That link has expired or was already used. Request a new one.",
    AccessDenied: "That account does not have access to weaseln.",
    Configuration: "Sign-in is not configured correctly. Please contact support.",
};

export default function LoginForm({
    callbackUrl,
    error,
    providers,
}: {
    callbackUrl: string;
    error?: string;
    providers: readonly EnabledProvider[];
}) {
    // Which control is mid-flight — doubles as the flag that disables the
    // others, so a second click cannot start a competing redirect.
    const [pending, setPending] = useState<string | null>(null);
    const [email, setEmail] = useState("");

    const busy = pending !== null;
    const message = error
        ? (ERROR_COPY[error] ??
          "Something went wrong signing you in. Please try again.")
        : null;

    /* "email" is the Auth.js type for the magic-link provider; everything else
       registered is a redirect-style button. Both come from what src/auth.ts
       actually built, so prod cannot advertise a method it never registered. */
    const emailProvider = providers.find((p) => p.type === "email");
    const oauthProviders = providers.filter((p) => p.type !== "email");

    const onOAuth = (provider: string) => {
        setPending(provider);
        signIn(provider, { callbackUrl });
    };

    const onEmail = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!emailProvider || !email.trim()) return;
        setPending(emailProvider.id);
        signIn(emailProvider.id, { email, callbackUrl });
    };

    return (
        <div className="flex flex-col gap-5">
            {message && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-field border border-error/30 bg-error/10 px-3.5 py-3 text-meta font-medium text-error"
                >
                    <FontAwesomeIcon
                        icon={faCircleExclamation}
                        aria-hidden="true"
                        className="mt-px w-3.5 shrink-0"
                    />
                    <span>{message}</span>
                </div>
            )}

            {oauthProviders.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    {oauthProviders.map(({ id }) => {
                        const { label, icon } = metaFor(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                disabled={busy}
                                onClick={() => onOAuth(id)}
                                className={cn(
                                    "group flex h-12 w-full items-center justify-center gap-3 border px-4",
                                    FIELD_SKIN,
                                    "font-semibold elev-1 press hover:elev-2",
                                )}
                            >
                                <FontAwesomeIcon
                                    icon={pending === id ? faSpinner : icon}
                                    aria-hidden="true"
                                    className={cn(
                                        "w-[1.05rem] text-base-content/70 transition-colors duration-200 group-hover:text-base-content",
                                        pending === id && "animate-spin",
                                    )}
                                />
                                <span className="text-sm">
                                    {pending === id
                                        ? "Redirecting…"
                                        : `Continue with ${label}`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Hairline rule with the label sitting in the gap. Only earns its
                keep when there is something on both sides of it. */}
            {oauthProviders.length > 0 && emailProvider && (
                <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-hairline" />
                    <span className="text-eyebrow uppercase text-muted">
                        or
                    </span>
                    <span className="h-px flex-1 bg-hairline" />
                </div>
            )}

            {emailProvider && (
                <>
                    <form onSubmit={onEmail} className="flex flex-col gap-2.5">
                        <label
                            htmlFor="login-email"
                            className="text-sm font-medium text-base-content"
                        >
                            Email address
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                            disabled={busy}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={cn(
                                FIELD_SKIN,
                                "input h-12",
                            )}
                        />
                        <button
                            type="submit"
                            disabled={busy}
                            className={cn(
                                "btn btn-primary group mt-1 h-12 min-h-12 w-full gap-2 rounded-field border-0",
                                "px-5 text-sm font-semibold elev-1 press hover:elev-2",
                                "disabled:pointer-events-none disabled:opacity-45",
                            )}
                        >
                            {pending === emailProvider.id ? (
                                <>
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        aria-hidden="true"
                                        className="w-4 animate-spin"
                                    />
                                    Sending link&hellip;
                                </>
                            ) : (
                                <>
                                    Send me a sign-in link
                                    <FontAwesomeIcon
                                        icon={faArrowRight}
                                        aria-hidden="true"
                                        className="w-3.5 transition-transform duration-200 ease-burrow group-hover:translate-x-0.5"
                                    />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-meta text-muted">
                        No password needed &mdash; we email you a one-time link
                        that signs you straight in.
                    </p>
                </>
            )}
        </div>
    );
}
