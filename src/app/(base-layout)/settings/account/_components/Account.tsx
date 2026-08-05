"use client";
import Modal from "@/components/ui/Modal";
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
    onUnlink: (providerLinked: string) => Promise<void>;
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
                    <h3 className="font-bold text-lg mt-4">
                        Remove{" "}
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}{" "}
                        Account
                    </h3>
                    <p className="text-md">
                        Are you sure you want to remove this account?
                    </p>
                    <div className="modal-action">
                        <form method="dialog">
                            <div className="flex gap-4">
                                <button
                                    className="btn btn-error"
                                    onClick={handleConfirmRemove}
                                >
                                    Remove
                                </button>
                                <button className="btn">Close</button>
                            </div>
                        </form>
                    </div>
                </Modal>
                <div className="lg:space-x-4 space-y-4">
                    <h2 className="text-2xl font-bold">
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
                                    className={`flex gap-4 items-center shadow-md w-72 justify-center p-4 ${
                                        linkAction === "Remove" &&
                                        "bg-error text-white"
                                    } rounded-lg`}
                                >
                                    <FontAwesomeIcon
                                        icon={PROVIDER_ICONS[
                                            provider as keyof typeof PROVIDER_ICONS
                                        ] ?? faGlobe}
                                        size="xl"
                                    />
                                    <p className="text-md">
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
                <h2 className="text-2xl font-bold">Delete Account</h2>
                <p className="text-md mt-4">
                    Deleting your account will remove all your posts, reactions,
                    comments and your information stored within our database.
                </p>
                <div className="mt-4 mb-4">
                    <input
                        className="input input-bordered"
                        onChange={(e) => setInputDelete(e.currentTarget.value)}
                    />
                    <p className="text-sm mt-2">
                        Type &quot;DELETE&quot; to proceed on deleting your
                        account.
                    </p>
                </div>
                <button
                    className="btn btn-error text-white"
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
