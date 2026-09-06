"use client";

import { User } from "@/generated/prisma/client";
import Navigation from "./ui/Navigation";
import QueryWrapper from "./provider/QueryWrapper";
import NextAuthProvider from "./provider/NextAuthProvider";

export default function WeaselnBgHomepage({ user }: { user: User }) {
    return (
        <QueryWrapper>
            <NextAuthProvider>
                <Navigation {...user} />
            </NextAuthProvider>
        </QueryWrapper>
    );
}
