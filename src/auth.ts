import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomInt } from "crypto";
import prisma from "@/db";

const usernameFrom = (source: string) =>
    source.replace(/\s/g, "").toLowerCase() + randomInt(1000, 10000);

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    providers: [
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST!,
                port: Number(process.env.EMAIL_SERVER_PORT) || 587,
                auth: {
                    user: process.env.EMAIL_SERVER_USER!,
                    pass: process.env.RESEND_API_KEY!,
                },
            },
            from: "no-reply@zefer.blog",
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                    username: usernameFrom(profile.given_name),
                };
            },
        }),
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.id.toString(),
                    name: profile.name ?? profile.login,
                    email: profile.email,
                    image: profile.avatar_url,
                    username: usernameFrom(profile.login),
                };
            },
        }),
    ],
    callbacks: {
        session: ({ session, token }) => {
            if (!token.sub) throw new Error("Missing token.sub in session callback");
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.sub,
                },
            };
        },
    },
    theme: {
        logo: "/icons/weaslnnobg.png",
    },
    pages: {
        newUser: "/settings/profile",
    },
});
