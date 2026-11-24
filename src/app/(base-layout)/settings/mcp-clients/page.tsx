import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
    listAuthorizedClients,
    listOAuthClients,
} from "@/modules/oauth/clients";
import { signInUrl } from "@/utils/signInUrl";

import McpClients from "./_components/McpClients";

export default async function McpClientsPage() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/settings/mcp-clients"));

    const [clients, authorized] = await Promise.all([
        listOAuthClients({ userId: session.user.id }),
        listAuthorizedClients({ userId: session.user.id }),
    ]);

    return (
        <div className="mx-auto lg:w-9/12 justify-center">
            <div className="rounded-box border border-hairline bg-surface p-5 elev-1 sm:p-6 space-y-5">
                <McpClients
                    initialClients={clients}
                    initialAuthorized={authorized}
                />
            </div>
        </div>
    );
}
