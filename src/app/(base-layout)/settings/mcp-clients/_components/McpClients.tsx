"use client";

import { useState } from "react";

import { OAUTH_SCOPES } from "@/modules/oauth/scopes";
import {
    createMcpClient,
    listMcpClients,
    revokeMcpClient,
} from "@/utils/actions/oauth";

type Client = {
    id: string;
    clientId: string;
    name: string;
    redirectUris: string[];
    scopes: string[];
    createdAt: Date;
    revokedAt: Date | null;
};

export default function McpClients({ initialClients }: { initialClients: Client[] }) {
    const [clients, setClients] = useState(initialClients);
    const [name, setName] = useState("");
    const [redirectUri, setRedirectUri] = useState(
        "http://127.0.0.1:19876/callback",
    );
    const [scopes, setScopes] = useState<string[]>([...OAUTH_SCOPES]);
    const [created, setCreated] = useState<{
        clientId: string;
        clientSecret: string;
    } | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function create() {
        setBusy(true);
        setError("");
        try {
            const result = await createMcpClient({
                name: name.trim() || "MCP client",
                redirectUris: [redirectUri.trim()],
                scopes,
            });
            setCreated(result);
            setName("");
            const listed = await refresh();
            setClients(listed);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Could not create the client.",
            );
        } finally {
            setBusy(false);
        }
    }

    async function refresh() {
        try {
            return await listMcpClients();
        } catch {
            return clients;
        }
    }

    async function revoke(clientId: string) {
        setBusy(true);
        setError("");
        try {
            await revokeMcpClient({ clientId });
            setClients(
                clients.map((client) =>
                    client.clientId === clientId
                        ? { ...client, revokedAt: new Date() }
                        : client,
                ),
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Could not revoke the client.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <h1 className="text-lg font-semibold">MCP clients</h1>
                <p className="text-sm opacity-80">
                    A client is a credential an MCP client uses to act as
                    you. The secret is shown once, when the client is
                    created.
                </p>
            </div>

            <div className="space-y-3">
                <label className="form-control w-full">
                    <span className="label-text">Name</span>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-label="Client name"
                        placeholder="OpenCode"
                    />
                </label>

                <label className="form-control w-full">
                    <span className="label-text">Redirect URI</span>
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        value={redirectUri}
                        onChange={(event) => setRedirectUri(event.target.value)}
                        aria-label="Redirect URI"
                    />
                </label>

                <fieldset className="space-y-1">
                    <legend className="label-text">Permissions</legend>
                    <div className="flex flex-wrap gap-3">
                        {OAUTH_SCOPES.map((scope) => (
                            <label
                                key={scope}
                                className="label cursor-pointer gap-2"
                            >
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={scopes.includes(scope)}
                                    onChange={(event) =>
                                        setScopes(
                                            event.target.checked
                                                ? [...scopes, scope]
                                                : scopes.filter(
                                                      (entry) =>
                                                          entry !== scope,
                                                  ),
                                        )
                                    }
                                    aria-label={`Permission ${scope}`}
                                />
                                <span className="label-text">{scope}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={create}
                    disabled={busy}
                    aria-label="Create an MCP client"
                >
                    Create client
                </button>
                {error ? (
                    <p className="text-sm text-error" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>

            <div className="overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Client id</th>
                            <th>Redirect URI</th>
                            <th>Permissions</th>
                            <th>State</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map((client) => (
                            <tr key={client.id}>
                                <td>{client.name}</td>
                                <td className="font-mono text-xs">
                                    {client.clientId}
                                </td>
                                <td className="text-xs">
                                    {client.redirectUris.join(", ")}
                                </td>
                                <td className="text-xs">
                                    {client.scopes.join(", ")}
                                </td>
                                <td>
                                    {client.revokedAt
                                        ? "Revoked"
                                        : "Active"}
                                </td>
                                <td>
                                    {!client.revokedAt ? (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline"
                                            onClick={() =>
                                                revoke(client.clientId)
                                            }
                                            disabled={busy}
                                            aria-label={`Revoke the client ${client.name}`}
                                        >
                                            Revoke
                                        </button>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {created ? (
                <dialog open className="modal" aria-label="New client secret">
                    <div className="modal-box space-y-3">
                        <h2 className="text-lg font-semibold">
                            Copy the secret now
                        </h2>
                        <p className="text-sm opacity-80">
                            It is shown once and never again.
                        </p>
                        <p className="font-mono text-xs break-all">
                            {created.clientId}
                        </p>
                        <p className="font-mono text-xs break-all">
                            {created.clientSecret}
                        </p>
                        <div className="modal-action">
                            <button
                                type="button"
                                className="btn btn-neutral"
                                onClick={() => setCreated(null)}
                                aria-label="Close the client secret"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </dialog>
            ) : null}
        </div>
    );
}
