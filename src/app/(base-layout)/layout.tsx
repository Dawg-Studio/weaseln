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

    return (
        <QueryWrapper>
            <NextAuthProvider>
                <Navigation
                    id={sessionUser?.id ?? ""}
                    name={sessionUser?.name ?? ""}
                    image={sessionUser?.image ?? ""}
                    username={sessionUser?.username ?? ""}
                />
                {children}
            </NextAuthProvider>
        </QueryWrapper>
    );
}
