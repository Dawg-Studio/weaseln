import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
// Use the path verified in Task 1.1 step 3:
import Nodemailer from "next-auth/providers/nodemailer";
// If Task 1.1 step 3 fallback: `import Nodemailer from "@auth/core/providers/nodemailer";`
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/db";
import generateRandom4DigitNumber from "@/utils/randomNumberGen4Digit";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    providers: [
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST!,
                port: Number(process.env.EMAIL_SERVER_PORT),
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
                    username:
                        profile.given_name.replace(/\s/g, "").toLowerCase() +
                        generateRandom4DigitNumber(),
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
                    username:
                        profile.login.replace(/\s/g, "").toLowerCase() +
                        generateRandom4DigitNumber(),
                };
            },
        }),
    ],
    callbacks: {
        session: ({ session, token }) => ({
            ...session,
            user: {
                ...session.user,
                id: token.sub!,
            },
        }),
    },
    theme: {
        logo: "/zefer.svg",
    },
    pages: {
        newUser: "/settings/profile",
    },
});