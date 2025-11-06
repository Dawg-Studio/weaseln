"use client";

import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons";

export default function SignIn() {
    const [providers, setProviders] = useState<any>(null);
    const [email, setEmail] = useState("");
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    useEffect(() => {
        const fetchProviders = async () => {
            const res = await getProviders();
            setProviders(res);
        };
        fetchProviders();
    }, []);

    const handleEmailSignIn = (e: React.FormEvent) => {
        e.preventDefault();
        signIn("email", { email, callbackUrl });
    };

    const getProviderIcon = (providerId: string) => {
        switch (providerId) {
            case "google":
                return faGoogle;
            case "github":
                return faGithub;
            default:
                return faEnvelope;
        }
    };

    const getProviderStyle = (providerId: string) => {
        switch (providerId) {
            case "google":
                return "btn-error";
            case "github":
                return "btn-neutral";
            default:
                return "btn-primary";
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Image
                            src="/zefer-text-with-logo.svg"
                            alt="ZeFer Logo"
                            width={180}
                            height={60}
                            priority
                        />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-center mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-center text-base-content/60 mb-6">
                        Sign in to continue to ZeFer
                    </p>

                    {/* Email Sign In Form */}
                    {providers?.email && (
                        <form onSubmit={handleEmailSignIn} className="mb-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Email</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    className="input input-bordered"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary w-full mt-4"
                            >
                                <FontAwesomeIcon icon={faEnvelope} />
                                Sign in with Email
                            </button>
                        </form>
                    )}

                    {/* Divider */}
                    {providers?.google || providers?.github ? (
                        <div className="divider">OR</div>
                    ) : null}

                    {/* OAuth Providers */}
                    <div className="space-y-3">
                        {providers?.google && (
                            <button
                                onClick={() =>
                                    signIn("google", { callbackUrl })
                                }
                                className={`btn ${getProviderStyle("google")} w-full`}
                            >
                                <FontAwesomeIcon
                                    icon={getProviderIcon("google")}
                                />
                                Continue with Google
                            </button>
                        )}
                        {providers?.github && (
                            <button
                                onClick={() =>
                                    signIn("github", { callbackUrl })
                                }
                                className={`btn ${getProviderStyle("github")} w-full`}
                            >
                                <FontAwesomeIcon
                                    icon={getProviderIcon("github")}
                                />
                                Continue with GitHub
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6">
                        <p className="text-sm text-base-content/60">
                            By signing in, you agree to our{" "}
                            <a href="/terms" className="link link-primary">
                                Terms
                            </a>{" "}
                            and{" "}
                            <a href="/privacy" className="link link-primary">
                                Privacy Policy
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
