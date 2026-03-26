import { withAuth } from "next-auth/middleware";

export default withAuth({
    secret: process.env.NEXTAUTH_SECRET,
});

export const config = {
    matcher: [
        "/new",
        "/:userId/:titleId/edit",
        "/settings/:path*",
        "/manage/:path*",
        "/api/post/manage/:path*",
        "/api/user/cloudinary/:path*",
        "/api/email/:path*",
    ],
};
