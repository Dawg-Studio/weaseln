import prisma from "@/db";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { AuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import generateRandom4DigitNumber from "./randomNumberGen4Digit";
import EmailProvider from "next-auth/providers/email";

export const authConfig: AuthOptions = {
    adapter: PrismaAdapter(prisma) as Adapter,
    session: {
        strategy: "jwt",
    },
    providers: [
        EmailProvider({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: process.env.EMAIL_SERVER_PORT as unknown as number,
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.RESEND_API_KEY,
                },
            },
            from: "no-reply@zefer.blog",
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
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
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
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
    secret: process.env.NEXTAUTH_SECRET as string,
    callbacks: {
        session: ({ session, token }) => ({
            ...session,
            user: {
                ...session.user,
                id: token.sub,
            },
        }),
        redirect: ({ url, baseUrl }) => {
            // Prevent redirect loops by ensuring we never redirect to signin page
            if (url.includes("/auth/signin")) {
                return baseUrl;
            }
            // If url is relative, make it absolute
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`;
            }
            // If url is on same origin, allow it
            if (new URL(url).origin === baseUrl) {
                return url;
            }
            // Default to baseUrl for external URLs
            return baseUrl;
        },
    },
    theme: {
        logo: "/zefer.svg",
    },
    pages: {
        signIn: "/auth/signin",
        newUser: "/settings/profile",
    },
};
