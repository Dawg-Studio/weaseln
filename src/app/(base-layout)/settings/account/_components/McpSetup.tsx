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
                        Register a client
                    </span>{" "}
                    — open{" "}
                    <Link
                        href="/settings/mcp-clients"
                        className="link link-primary"
                    >
                        MCP clients
                    </Link>
                    , give it a name, a redirect URI and the permissions it
                    needs. A native app uses a loopback address such as{" "}
                    <code className="font-mono text-xs">
                        http://127.0.0.1:19876/callback
                    </code>
                    ; a web client uses an{" "}
                    <code className="font-mono text-xs">https://</code>{" "}
                    address.
                </li>
                <li>
                    <span className="font-semibold text-base-content">
                        Copy the client id and secret
                    </span>{" "}
                    — the secret is shown once, when the client is created.
                </li>
                <li>
                    <span className="font-semibold text-base-content">
                        Point your client at the endpoint
                    </span>{" "}
                    — paste this into your client&rsquo;s configuration and
                    replace the two placeholders with the credentials from
                    step 2. The scope list must name only the permissions the
                    client was registered with.
                    <div className="mt-3 flex flex-col items-start gap-2">
                        <pre className="w-full overflow-x-auto rounded-box border border-hairline bg-sunk p-3 font-mono text-xs leading-relaxed text-base-content">
                            {config}
                        </pre>
                        <CopyButton
                            value={config}
                            label="Copy the MCP client configuration"
                        />
                    </div>
                </li>
                <li>
                    <span className="font-semibold text-base-content">
                        Authorize
                    </span>{" "}
                    — the first request opens the consent screen in your
                    browser. Sign in, check the permissions it asks for and
                    allow it. The client then exchanges the code for a token
                    and refreshes it on its own.
                </li>
            </ol>

            <div className="mt-6">
                <h3 className="text-sm font-semibold text-base-content">
                    Permissions
                </h3>
                <p className="measure mt-2 text-sm text-base-content/70">
                    A client is registered with the permissions it needs, and
                    a token can never carry a permission the client was not
                    registered with.
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
                .
            </p>
        </div>
    );
}
