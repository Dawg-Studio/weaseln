import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomInt } from "crypto";
import prisma from "@/db";
import { isProd } from "@/utils/isProd";

const usernameFrom = (source: string) =>
    source.replace(/\s/g, "").toLowerCase() + randomInt(1000, 10000);

const google = Google({
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
});

const providers = isProd
    ? [google]
    : [
          google,
          Resend({
              apiKey: process.env.RESEND_API_KEY!,
              from: "no-reply@weaseln.blog",
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
      ];

/* The login page renders one control per sign-in method, so it needs to know what
   `providers` actually resolved to — in production that is Google alone. Exporting
   the resolved shape keeps src/app/login from re-deriving the isProd branch above
   and drifting out of sync with it, which is how the page came to advertise GitHub
   and email buttons that could only ever fail in prod. `type` is Auth.js's own
   discriminator; "email" marks the magic-link provider. */
export const enabledProviders = providers.map(({ id, type }) => ({ id, type }));

export type EnabledProvider = (typeof enabledProviders)[number];

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    providers,
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
        // The mark, not the lockup: Auth.js caps theme.logo at 20px, where the
        // lockup's baked-in wordmark and tagline are unreadable. `pages` below
        // replaces every built-in screen except sign-out, which still uses it.
        logo: "/icons/weasln-mark.png",
    },
    pages: {
        // Replaces the stock Auth.js sign-in screen with the branded page in
        // src/app/login. `error` points at the same route on purpose: the page
        // renders the ?error= code inline, so a failed provider round trip
        // lands the reader back on the form instead of a bare error screen.
        signIn: "/login",
        error: "/login",
        verifyRequest: "/login/verify",
        newUser: "/settings/profile",
    },
});
