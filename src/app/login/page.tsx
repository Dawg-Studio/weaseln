import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBookOpen,
    faFeather,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { auth, enabledProviders } from "@/auth";
import { safeCallback } from "@/utils/safeCallback";
import LoginForm from "./_components/LoginForm";
import Wordmark from "./_components/Wordmark";

export const metadata: Metadata = {
    title: "Sign in",
    description:
        "Sign in to weaseln to publish your writing, follow the people you care about, and build your reading list.",
};

const HIGHLIGHTS = [
    {
        icon: faFeather,
        title: "Write without friction",
        body: "A rich editor that stays out of the way, with drafts saved as you go.",
    },
    {
        icon: faUsers,
        title: "Find your readers",
        body: "Follow writers and tags, and let the right people find your work.",
    },
    {
        icon: faBookOpen,
        title: "Keep what matters",
        body: "Bookmark posts into a reading list you can come back to anytime.",
    },
];

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
    const { callbackUrl: rawCallback, error } = await searchParams;
    const callbackUrl = safeCallback(rawCallback);

    // Nothing to sign in to if there is already a session — send them on.
    const session = await auth();
    if (session?.user) redirect(callbackUrl);

    return (
        <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
            {/* ------------------------------ brand rail ------------------------------
                Hidden below lg: on a phone the form is the whole job, and a
                decorative half would push it under the fold. */}
            <aside className="relative hidden overflow-hidden bg-base-200 brand-wash lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
                <div
                    className="absolute inset-0 brand-dots opacity-60"
                    aria-hidden="true"
                />

                <div className="relative">
                    <Wordmark />
                </div>

                <div className="relative max-w-lg enter">
                    <p className="text-eyebrow uppercase text-primary">
                        Your story is yours to unfold
                    </p>
                    <h1 className="mt-4 text-display text-base-content">
                        Content for humans, by humans.
                    </h1>
                    <ul className="mt-10 flex flex-col gap-6">
                        {HIGHLIGHTS.map(({ icon, title, body }, i) => (
                            <li
                                key={title}
                                className="flex items-start gap-4 enter"
                                style={
                                    {
                                        "--enter-delay": `${120 + i * 90}ms`,
                                    } as React.CSSProperties
                                }
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-tint text-primary"
                                >
                                    <FontAwesomeIcon
                                        icon={icon}
                                        className="w-4"
                                    />
                                </span>
                                <div>
                                    <p className="font-semibold text-base-content">
                                        {title}
                                    </p>
                                    <p className="mt-0.5 text-meta text-muted">
                                        {body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-meta text-muted">
                    Open source, and free to write on.
                </p>
            </aside>

            {/* -------------------------------- form ---------------------------------- */}
            <section className="flex flex-col justify-center bg-base-100 px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
                <div className="mx-auto w-full max-w-md">
                    {/* The rail is hidden on small screens, so the mark comes back here. */}
                    <Wordmark className="mb-8 lg:hidden" />

                    <div className="enter-fade">
                        <h2 className="text-title text-base-content">
                            Welcome back
                        </h2>
                        <p className="mt-2 text-subhead text-muted">
                            Sign in to keep writing, reading and following.
                        </p>
                    </div>

                    <div className="mt-8 rounded-box border border-hairline bg-surface p-6 elev-2 enter-fade [--enter-delay:90ms] sm:p-7">
                        <LoginForm
                            callbackUrl={callbackUrl}
                            error={error}
                            providers={enabledProviders}
                        />
                    </div>

                    <p className="mt-6 text-meta text-muted">
                        By continuing you agree to our{" "}
                        <Link
                            href="/terms"
                            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
                        >
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="/privacy"
                            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
                        >
                            Privacy Policy
                        </Link>
                        .
                    </p>

                    <Link
                        href="/"
                        className="group mt-8 inline-flex items-center gap-2 rounded-field text-meta font-medium text-muted transition-colors hover:text-base-content"
                    >
                        <FontAwesomeIcon
                            icon={faArrowLeft}
                            aria-hidden="true"
                            className="w-3 transition-transform duration-200 ease-burrow group-hover:-translate-x-0.5"
                        />
                        Back to weaseln
                    </Link>
                </div>
            </section>
        </main>
    );
}
