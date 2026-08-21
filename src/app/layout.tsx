import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import NextTopLoader from "nextjs-toploader";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import ThemeProvider from "@/components/provider/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { Suspense } from "react";
config.autoAddCss = false;

const inter = Inter({ subsets: ["latin"] });

const APP_NAME = "Weaseln";
const APP_DEFAULT_TITLE =
    "Weaseln, a publishing platform for developers and creatives alike.";
const APP_TITLE_TEMPLATE = "%s | Weaseln";
const APP_DESCRIPTION =
    "A dynamic publishing platform for developers and creatives to share their content or story to the world.";

export const viewport: Viewport = {
    themeColor: "#FBF8F0",
};

export const metadata: Metadata = {
    metadataBase:
        process.env.NODE_ENV === "production"
            ? new URL("https://zefer.blog")
            : new URL("http://localhost:3000"),
    applicationName: APP_NAME,
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    openGraph: {
        type: "website",
        siteName: APP_NAME,
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
        images: "/weaseln-bg.svg",
    },
    twitter: {
        card: "summary",
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
    authors: [
        {
            name: "Romel Jr Zerna",
            url: "https://linktr.ee/leindfraust",
        },
        {
            name: "Mel Fatima Fernandez",
        },
    ],
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: APP_DEFAULT_TITLE,
        startupImage: "/icons/512.png",
    },
    category: "",
    formatDetection: {
        telephone: false,
    },
    keywords: [
        "Weaseln",
        "blog",
        "publishing",
        "developers",
        "creatives",
        "content",
        "story",
        "weaseln",
        "publishing platform",
        "blog posts",
        "posts",
        "creator",
        "content sharing",
        "story sharing",
        "content creator",
    ],
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" data-theme="light" suppressHydrationWarning>
            <body className={inter.className}>
                <script
                    dangerouslySetInnerHTML={{
                        __html:
                            "(function(){try{var t=localStorage.getItem('theme');" +
                            "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);" +
                            "}catch(e){}})()",
                    }}
                />
                <ThemeProvider />
                <Suspense>
                    <NextTopLoader showSpinner={false} />
                </Suspense>
                {/* react-hot-toast hardcodes `background:#fff; color:#363636`
                    as an INLINE style, so a className alone cannot reach it —
                    the inline values have to be neutralised first, then the
                    token-based surface applied through the class. */}
                <Toaster
                    position="top-center"
                    gutter={24}
                    toastOptions={{
                        className:
                            "rounded-box border border-hairline bg-surface text-base-content elev-3",
                        style: {
                            background: "transparent",
                            boxShadow: "none",
                            color: "inherit",
                        },
                    }}
                />
                {children}
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
