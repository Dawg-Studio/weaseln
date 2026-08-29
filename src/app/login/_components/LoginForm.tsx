"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faGithub } from "@fortawesome/free-brands-svg-icons";
import {
    faArrowRight,
    faCircleExclamation,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/utils/cn";

const OAUTH_PROVIDERS = [
    { id: "google", label: "Google", icon: faGoogle },
    { id: "github", label: "GitHub", icon: faGithub },
] as const;

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

/* The shared skin for the email field and the OAuth tiles: a raised sheet on
   the cream canvas, warm hairline at rest, rust on focus. Lifted from
   components/ui/Input.tsx so the auth page and the app forms stay one system. */
const FIELD_SKIN =
    "w-full rounded-field border border-hairline bg-surface text-base-content " +
    "transition-[border-color,box-shadow,background-color] duration-150 ease-burrow " +
    "placeholder:text-muted hover:border-hairline-strong focus:border-primary";

export default function LoginForm({
    callbackUrl,
    error,
}: {
    callbackUrl: string;
    error?: string;
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

    const onOAuth = (provider: string) => {
        setPending(provider);
        signIn(provider, { callbackUrl });
    };

    const onEmail = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim()) return;
        setPending("nodemailer");
        signIn("nodemailer", { email, callbackUrl });
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

            <div className="flex flex-col gap-2.5">
                {OAUTH_PROVIDERS.map(({ id, label, icon }) => (
                    <button
                        key={id}
                        type="button"
                        disabled={busy}
                        onClick={() => onOAuth(id)}
                        className={cn(
                            "group flex h-12 w-full items-center justify-center gap-3 px-4",
                            FIELD_SKIN,
                            "font-semibold elev-1 press hover:elev-2",
                            "disabled:pointer-events-none disabled:opacity-45",
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
                ))}
            </div>

            {/* Hairline rule with the label sitting in the gap. */}
            <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-eyebrow uppercase text-muted">or</span>
                <span className="h-px flex-1 bg-hairline" />
            </div>

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
                        "input h-12 disabled:pointer-events-none disabled:opacity-45",
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
                    {pending === "nodemailer" ? (
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
                No password needed &mdash; we email you a one-time link that signs
                you straight in.
            </p>
        </div>
    );
}
