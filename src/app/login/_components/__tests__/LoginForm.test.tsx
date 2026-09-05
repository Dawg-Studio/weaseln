import { describe, it, expect, vi, beforeEach } from "vitest";

const signIn = vi.fn();

vi.mock("next-auth/react", () => ({
    signIn: (...args: unknown[]) => signIn(...args),
    signOut: vi.fn(),
    useSession: () => ({ data: null, status: "unauthenticated" }),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { render, screen, fireEvent } from "@testing-library/react";
import LoginForm from "../LoginForm";
import type { EnabledProvider } from "@/auth";

/* The two shapes src/auth.ts actually produces: prod gates everything but Google
   behind `isProd`, dev registers all three. The page reads that list at request
   time, so these stand in for it. */
const PROD: EnabledProvider[] = [{ id: "google", type: "oidc" }];
const DEV: EnabledProvider[] = [
    { id: "google", type: "oidc" },
    { id: "nodemailer", type: "email" },
    { id: "github", type: "oauth" },
];

const emailForm = () => screen.queryByLabelText(/email address/i);

describe("LoginForm provider rendering", () => {
    beforeEach(() => signIn.mockClear());

    it("shows only the providers that are registered in production", () => {
        render(<LoginForm callbackUrl="/" providers={PROD} />);

        expect(
            screen.getByRole("button", { name: /continue with google/i }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /continue with github/i }),
        ).not.toBeInTheDocument();
        // The regression: an email form here can only ever bounce to a generic
        // error, because nodemailer is not registered in prod.
        expect(emailForm()).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /send me a sign-in link/i }),
        ).not.toBeInTheDocument();
    });

    it("drops the or-divider when there is nothing on both sides of it", () => {
        const { container } = render(
            <LoginForm callbackUrl="/" providers={PROD} />,
        );
        expect(container.textContent).not.toMatch(/\bor\b/i);
    });

    it("shows every provider in the dev configuration", () => {
        render(<LoginForm callbackUrl="/" providers={DEV} />);

        expect(
            screen.getByRole("button", { name: /continue with google/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /continue with github/i }),
        ).toBeInTheDocument();
        expect(emailForm()).toBeInTheDocument();
    });

    it("signs in through the email provider's own id, not a hardcoded one", () => {
        render(
            <LoginForm
                callbackUrl="/feed"
                providers={[{ id: "resend", type: "email" }]}
            />,
        );

        fireEvent.change(screen.getByLabelText(/email address/i), {
            target: { value: "reader@example.com" },
        });
        fireEvent.click(
            screen.getByRole("button", { name: /send me a sign-in link/i }),
        );

        expect(signIn).toHaveBeenCalledWith("resend", {
            email: "reader@example.com",
            callbackUrl: "/feed",
        });
    });

    it("passes the sanitised callbackUrl through to an oauth sign-in", () => {
        render(<LoginForm callbackUrl="/feed" providers={PROD} />);
        fireEvent.click(
            screen.getByRole("button", { name: /continue with google/i }),
        );
        expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/feed" });
    });

    it("still renders a provider it has no icon for, rather than hiding it", () => {
        render(
            <LoginForm
                callbackUrl="/"
                providers={[{ id: "gitlab", type: "oauth" }]}
            />,
        );
        expect(
            screen.getByRole("button", { name: /continue with gitlab/i }),
        ).toBeInTheDocument();
    });

    it("renders nothing clickable when no provider is registered", () => {
        render(<LoginForm callbackUrl="/" providers={[]} />);
        expect(screen.queryAllByRole("button")).toHaveLength(0);
        expect(emailForm()).not.toBeInTheDocument();
    });
});
