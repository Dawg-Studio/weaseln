import { auth } from "@/auth";

export default auth;

export const config = {
    matcher: [
        "/new",
        "/:userId/:titleId/edit",
        "/settings/:path*",
        "/manage/:path*",
        "/api/post/manage/:path*",
        "/api/user/cloudinary/:path*",
        "/api/email/:path*",
        // Explicitly exclude API auth endpoints and cron
        // (the matcher syntax above already excludes /api/auth by not listing it)
    ],
};
