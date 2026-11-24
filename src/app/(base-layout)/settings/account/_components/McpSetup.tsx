"use client";

import {
    OAUTH_SCOPES,
    OAUTH_SCOPE_DESCRIPTIONS,
} from "@/modules/oauth/scopes";
import { faClipboard } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-hot-toast";

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied", { id: "mcp" });
        } catch {
            toast.error("Could not copy to the clipboard", { id: "mcp" });
        }
    }

    return (
        <button
            type="button"
            className="btn btn-sm btn-neutral press"
            aria-label={label}
            onClick={copy}
        >
            <FontAwesomeIcon icon={faClipboard} aria-hidden="true" />
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

export default function McpSetup({ endpoint }: { endpoint: string }) {
    const config = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "weaseln": {
        "type": "remote",
        "url": "${endpoint}"
      }
    }
  }
}`;

    const registeredClientConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "weaseln": {
        "type": "remote",
        "url": "${endpoint}",
        "oauth": {
          "client_id": "<client id>",
          "client_secret": "<client secret>",
          "scope": "${OAUTH_SCOPES.join(" ")}",
          "callback_port": 19876,
          "redirect_uri": "http://127.0.0.1:19876/callback"
        }
      }
    }
  }
}`;

    return (
        <div className="container pt-4">
            <h2 className="brand-rule text-headline text-base-content">
                MCP
            </h2>
            <p className="measure mt-4 text-sm text-base-content/70">
                Let an MCP client act as you. It can publish and manage your
                posts, run your organization, and change your profile, your
                design and your portfolio.
            </p>

            <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold text-base-content">
                    Endpoint
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                    <code className="min-w-0 flex-1 break-all rounded-field border border-hairline bg-sunk px-3 py-2 font-mono text-xs text-base-content">
                        {endpoint}
                    </code>
                    <CopyButton
                        value={endpoint}
                        label="Copy the MCP endpoint URL"
                    />
                </div>
            </div>

            <ol className="measure mt-5 list-decimal space-y-4 pl-5 text-sm text-base-content/70">
                <li>
                    <span className="font-semibold text-base-content">
                        Point your client at the endpoint
                    </span>{" "}
                    — paste this into your client&rsquo;s configuration.
                    There is no key to copy: the client names itself with a
                    public <code className="font-mono text-xs">https://</code>{" "}
                    document, and the browser sign-in is the only thing you
                    do.
                    <div className="mt-3 flex flex-col items-start gap-2">
                        <pre className="w-full overflow-x-auto rounded-box border border-hairline bg-sunk p-3 font-mono text-xs leading-relaxed text-base-content">
                            {config}
                        </pre>
                        <CopyButton
                            value={config}
                            label="Copy the MCP client configuration"
                        />
                    </div>
                    <p className="mt-3">
                        Leave{" "}
                        <code className="font-mono text-xs">
                            oauth.redirect_uri
                        </code>{" "}
                        out of it. Setting it stops OpenCode looking for the
                        metadata document, so a stale one sends you down the
                        registered-client path below without saying so.
                    </p>
                </li>
                <li>
                    <span className="font-semibold text-base-content">
                        Authorize
                    </span>{" "}
                    — the first request opens the consent screen in your
                    browser. It names the document&rsquo;s origin
                    (&ldquo;opencode.ai&rdquo; for OpenCode), warns that the
                    app registered itself, and lists the permissions it will
                    get. Sign in, check all of it and allow it. The client then
                    exchanges the code for a token and refreshes it on its own.
                </li>
                <li>
                    <span className="font-semibold text-base-content">
                        If your client cannot do that
                    </span>{" "}
                    — a client without metadata-document support needs a
                    registered one. Open{" "}
                    <Link
                        href="/settings/mcp-clients"
                        className="link link-primary"
                    >
                        MCP clients
                    </Link>
                    , create a client with a name, a redirect URI and the
                    permissions it needs; a native app uses a loopback address
                    such as{" "}
                    <code className="font-mono text-xs">
                        http://127.0.0.1:19876/callback
                    </code>
                    , a web client uses an{" "}
                    <code className="font-mono text-xs">https://</code>{" "}
                    address. Copy the client id and secret — the secret is
                    shown once — into this configuration instead.
                    <div className="mt-3 flex flex-col items-start gap-2">
                        <pre className="w-full overflow-x-auto rounded-box border border-hairline bg-sunk p-3 font-mono text-xs leading-relaxed text-base-content">
                            {registeredClientConfig}
                        </pre>
                        <CopyButton
                            value={registeredClientConfig}
                            label="Copy the registered-client configuration"
                        />
                    </div>
                </li>
            </ol>

            <div className="mt-6">
                <h3 className="text-sm font-semibold text-base-content">
                    Permissions
                </h3>
                <p className="measure mt-2 text-sm text-base-content/70">
                    A client registered in Settings can only be granted the
                    permissions it was created with. A client that names itself
                    with a metadata document asks for its permissions directly,
                    and the consent screen lists what it will get before you
                    allow it.
                </p>
                <dl className="measure mt-3 space-y-1 text-sm">
                    {OAUTH_SCOPES.map((scope) => (
                        <div
                            key={scope}
                            className="flex flex-wrap gap-x-2"
                        >
                            <dt className="font-mono text-xs text-base-content">
                                {scope}
                            </dt>
                            <dd className="text-base-content/70">
                                {OAUTH_SCOPE_DESCRIPTIONS[scope]}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>

            <p className="measure mt-5 text-sm text-base-content/70">
                The endpoint speaks OAuth 2.1 with PKCE. The discovery
                documents are at{" "}
                <code className="font-mono text-xs">
                    /.well-known/oauth-authorization-server
                </code>{" "}
                and{" "}
                <code className="font-mono text-xs">
                    /.well-known/oauth-protected-resource/api/mcp
                </code>
                . The first one publishes{" "}
                <code className="font-mono text-xs">
                    client_id_metadata_document_supported: true
                </code>
                , which is how a client knows it can sign in without a key.
            </p>
        </div>
    );
}
