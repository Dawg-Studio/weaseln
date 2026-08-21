
import prisma from "@/db";
import { auth } from "@/auth";
import AccountSettingsComponent from "@/app/(base-layout)/settings/account/_components/Account";
import ApiKeys from "./_components/ApiKeys";
import maskString from "@/utils/maskString";

export default async function AccountSettings() {
    const session = await auth();
    const linkedProviders = await prisma.account.findMany({
        where: { userId: session?.user.id },
        select: {
            id: true,
            providerAccountId: true,
            provider: true,
        },
    });
    const apiKeys = await prisma.apiKey.findMany({
        where: { ownerId: session?.user.id, isActive: true },
    });

    const maskedKeys = apiKeys.map((key) => ({
        ...key,
        key: maskString(key?.key),
    }));

    return (
        <div className="mx-auto lg:w-9/12 justify-center">
            <div className="rounded-box border border-hairline bg-surface p-5 elev-1 sm:p-6 space-y-5">
                <AccountSettingsComponent providers={[...linkedProviders]} />
                <ApiKeys initialApiKeys={maskedKeys} />
            </div>
        </div>
    );
}
