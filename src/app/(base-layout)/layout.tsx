import Navigation from "@/components/ui/Navigation";

import QueryWrapper from "@/components/provider/QueryWrapper";
import NextAuthProvider from "@/components/provider/NextAuthProvider";
import { getSessionUser } from "@/utils/server/loaders";

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
        return (
            <QueryWrapper>
                <NextAuthProvider>{children}</NextAuthProvider>
            </QueryWrapper>
        );
    }

    return (
        <QueryWrapper>
            <NextAuthProvider>
                <Navigation {...sessionUser} />
                {children}
            </NextAuthProvider>
        </QueryWrapper>
    );
}
