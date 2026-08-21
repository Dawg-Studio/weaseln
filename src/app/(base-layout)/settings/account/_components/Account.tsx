"use client";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { deleteUser, unlinkAccount } from "@/utils/actions/account";
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";

const AVAILABLE_PROVIDERS = ["google", "github"] as const;
const PROVIDER_ICONS = {
    google: faGoogle,
    github: faGithub,
};

function ProviderList({
    linkAction,
    displayProviders,
    onUnlink,
}: {
    linkAction: "Connect" | "Remove";
    displayProviders: string[];
    onUnlink: (_provider: string) => Promise<void>;
}) {
    const modalOauthRemoveRef = useRef<HTMLDialogElement>(null);
    const [provider, setProvider] = useState<string>("");

    function handleModalRemove(selectedProvider: string) {
        setProvider(selectedProvider);
        modalOauthRemoveRef.current?.show();
    }

    async function handleConfirmRemove() {
        modalOauthRemoveRef.current?.close();
        await onUnlink(provider);
    }

    return (
        <>
            <div className="container pt-4">
                <Modal ref={modalOauthRemoveRef}>
                    <h3 className="mt-4 text-headline text-base-content">
                        Remove{" "}
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}{" "}
                        Account
                    </h3>
                    <p className="measure text-sm text-base-content/70">
                        Are you sure you want to remove this account?
                    </p>
                    <div className="modal-action mt-6 gap-2 pt-4 hairline-t">
                        <form method="dialog">
                            <div className="flex gap-2">
                                <button
                                    className="btn btn-error h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                                    onClick={handleConfirmRemove}
                                >
                                    Remove
                                </button>
                                <button className="btn btn-ghost h-11 min-h-11 rounded-field px-5 text-sm font-semibold press">
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
                <div className="lg:space-x-4 space-y-4">
                    <h2 className="brand-rule text-headline text-base-content">
                        {linkAction} OAuth Accounts
                    </h2>
                    {displayProviders.map((provider) => (
                        <Fragment key={provider}>
                            <button
                                onClick={() =>
                                    linkAction === "Connect"
                                        ? signIn(provider)
                                        : handleModalRemove(provider)
                                }
                            >
                                <div
                                    className={cn(
                                        "flex w-72 items-center justify-center gap-4 rounded-box border border-hairline p-4 elev-1 press",
                                        // `text-white` on an error fill is only
                                        // 2.87:1 against the dark theme's error.
                                        // error-content is tuned per theme
                                        // (5.64:1 light / 6.48:1 dark).
                                        linkAction === "Remove"
                                            ? "bg-error text-error-content"
                                            : "bg-surface text-base-content",
                                    )}
                                >
                                    <FontAwesomeIcon
                                        icon={PROVIDER_ICONS[
                                            provider as keyof typeof PROVIDER_ICONS
                                        ] ?? faGlobe}
                                        size="xl"
                                    />
                                    <p className="text-sm font-medium">
                                        {linkAction === "Connect"
                                            ? "Sign in with"
                                            : "Remove"}{" "}
                                        {provider.charAt(0).toUpperCase() +
                                            provider.slice(1)}
                                    </p>
                                </div>
                            </button>
                        </Fragment>
                    ))}
                </div>
            </div>
        </>
    );
}

export default function AccountSettingsComponent({
    providers,
}: {
    providers: Array<{
        id: string;
        providerAccountId: string;
        provider: string;
    }>;
}) {
    const router = useRouter();
    const [inputDelete, setInputDelete] = useState<string>("");

    const providersCanConnect = (() => {
        const providersAvailable: string[] = [];
        for (const provider of providers) {
            const notThis = AVAILABLE_PROVIDERS.find(
                (providerName) => providerName !== provider.provider,
            );
            const alreadyLinked = providers.some(
                (p) => p.provider === notThis,
            );
            if (notThis && !alreadyLinked && !providersAvailable.includes(notThis)) {
                providersAvailable.push(notThis);
            }
        }
        return providersAvailable;
    })();

    const providersCanRemove = providers
        .map((provider) => provider.provider)
        .filter((providerName) =>
            (AVAILABLE_PROVIDERS as readonly string[]).includes(providerName),
        );

    async function unlinkProviderAccount(providerLinked: string) {
        const providerDetails = providers.find(
            (provider) => provider.provider === providerLinked,
        );
        if (providerDetails) {
            const unlink = await unlinkAccount(
                providerDetails.id,
                providerDetails.providerAccountId,
            );
            if (unlink) router.refresh();
        }
    }

    async function deleteAccount() {
        const deleteUserAccount = await deleteUser();
        if (deleteUserAccount) signOut();
    }

    return (
        <>
            {providersCanConnect.length !== 0 && (
                <ProviderList
                    linkAction="Connect"
                    displayProviders={providersCanConnect}
                    onUnlink={unlinkProviderAccount}
                />
            )}
            {providersCanRemove.length > 1 && (
                <ProviderList
                    linkAction="Remove"
                    displayProviders={providersCanRemove}
                    onUnlink={unlinkProviderAccount}
                />
            )}
            <div className="container pt-4">
                <h2 className="brand-rule text-headline text-base-content">
                    Delete Account
                </h2>
                <p className="measure mt-4 text-sm text-base-content/70">
                    Deleting your account will remove all your posts, reactions,
                    comments and your information stored within our database.
                </p>
                <div className="mt-4 mb-4">
                    <input
                        aria-label='Type DELETE to confirm account deletion'
                        className="input h-11 w-full rounded-field border-hairline bg-surface text-base-content transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-hairline-strong focus:border-primary focus:[--input-color:var(--color-primary)] max-w-xs"
                        onChange={(e) => setInputDelete(e.currentTarget.value)}
                    />
                    <p className="mt-2 text-meta text-muted">
                        Type &quot;DELETE&quot; to proceed on deleting your
                        account.
                    </p>
                </div>
                <button
                    className="btn btn-error h-11 min-h-11 rounded-field px-5 text-sm font-semibold press"
                    value={inputDelete}
                    disabled={inputDelete !== "DELETE"}
                    onClick={deleteAccount}
                >
                    Delete Account
                </button>
            </div>
        </>
    );
}
