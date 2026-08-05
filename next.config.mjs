import socketURL from "./src/utils/socketURL.mjs";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({
    dest: "public",
});

const nextConfig = {
    async headers() {
        return [
            {
                source: "/socket.io",
                headers: [
                    { key: "Access-Control-Allow-Credentials", value: "true" },
                    { key: "Access-Control-Allow-Origin", value: socketURL },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET, DELETE, PATCH, POST, PUT",
                    },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
                    },
                ],
            },
        ];
    },

    images: {
        // ponytail: dicebear avatars are SVGs. Next.js refuses SVG by default
        // (they can run scripts); CSP below blocks scripts + sandboxed iframe.
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: "",
                pathname: "/u/**",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/a/**",
            },
            {
                protocol: "https",
                hostname: "api.dicebear.com",
            },
        ],
    },
    async redirects() {
        return [
            {
                source: "/manage",
                destination: "/manage/posts",
                permanent: true,
            },
            {
                source: "/settings",
                destination: "/settings/profile",
                permanent: true,
            },
        ];
    },
};

const pwaConfig = withPWA(nextConfig);

const sentryConfig = withSentryConfig(pwaConfig, {
    silent: true,
    org: "romel-jr-zerna",
    project: "zefer",
}, {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
});

export default sentryConfig;
