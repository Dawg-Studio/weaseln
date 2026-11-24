import prisma from "@/db";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccountSettingsComponent from "@/app/(base-layout)/settings/account/_components/Account";
import ApiKeys from "./_components/ApiKeys";
import McpSetup from "./_components/McpSetup";
import maskString from "@/utils/maskString";
import { originFrom } from "@/utils/requestOrigin";
import { signInUrl } from "@/utils/signInUrl";

export default async function AccountSettings() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/settings/account"));
    const linkedProviders = await prisma.account.findMany({
        where: { userId: session.user.id },
        select: {
            id: true,
            providerAccountId: true,
            provider: true,
        },
    });
    const apiKeys = await prisma.apiKey.findMany({
        where: { ownerId: session.user.id, isActive: true },
    });

    const maskedKeys = apiKeys.map((key) => ({
        ...key,
        key: maskString(key?.key),
    }));

    // The endpoint the reader copies has to be the host they are on: a
    // token is minted for the origin of the request, so a client pointed
    // at another host is refused on every call.
    const origin = originFrom(await headers());

    return (
        <div className="mx-auto lg:w-9/12 justify-center">
            <div className="rounded-box border border-hairline bg-surface p-5 elev-1 sm:p-6 space-y-5">
                <AccountSettingsComponent providers={[...linkedProviders]} />
                <ApiKeys initialApiKeys={maskedKeys} />
                <McpSetup endpoint={`${origin}/api/mcp`} />
            </div>
        </div>
    );
}
