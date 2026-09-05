import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons";
import Wordmark from "../_components/Wordmark";

export const metadata: Metadata = {
    title: "Check your email",
    description: "A one-time sign-in link is on its way to your inbox.",
};

/* Where Auth.js parks the reader after the Nodemailer provider accepts an
   address (configured as pages.verifyRequest in src/auth.ts). It is a dead end
   by design — the journey continues in their inbox, so the only affordance
   here is the way back. */
export default function VerifyRequestPage() {
    return (
        <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-base-100 px-5 py-10 brand-wash">
            <div className="absolute inset-0 brand-dots opacity-50" aria-hidden="true" />

            <div className="relative w-full max-w-md">
                <Wordmark className="mb-8" />

                <div className="rounded-box border border-hairline bg-surface p-7 elev-2 enter sm:p-8">
                    <span
                        aria-hidden="true"
                        className="flex h-12 w-12 items-center justify-center rounded-field bg-tint text-primary"
                    >
                        <FontAwesomeIcon icon={faEnvelopeOpenText} className="w-5" />
                    </span>

                    <h1 className="mt-5 text-title text-base-content">
                        Check your email
                    </h1>
                    <p className="mt-3 text-subhead text-muted">
                        We sent you a one-time sign-in link. Open it on this
                        device and you will be signed straight in &mdash; no
                        password required.
                    </p>

                    <div className="mt-6 rounded-field border border-hairline bg-sunk px-4 py-3">
                        <p className="text-meta text-muted">
                            Nothing yet? Give it a minute, then check your spam
                            folder. The link expires after a single use.
                        </p>
                    </div>

                    <Link
                        href="/login"
                        className="group mt-7 inline-flex items-center gap-2 rounded-field text-meta font-semibold text-primary transition-colors hover:text-base-content"
                    >
                        <FontAwesomeIcon
                            icon={faArrowLeft}
                            aria-hidden="true"
                            className="w-3 transition-transform duration-200 ease-burrow group-hover:-translate-x-0.5"
                        />
                        Use a different address
                    </Link>
                </div>
            </div>
        </main>
    );
}
