import { type DefaultSession } from "next-auth";

declare module "next-auth" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}
