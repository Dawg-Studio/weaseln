import prisma from "@/db";
// import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";

import Tiptap from "@/components/wysiwyg/Tiptap";
import { JSONContent } from "@tiptap/react";
import { signInUrl } from "@/utils/signInUrl";
import { getAllTags } from "@/utils/server/loaders";

// export async function generateMetadata({
//     params,
// }): Promise<Metadata> {
//     const { userId, slug } = params;
//     const post = await prisma.post.findFirst({
//         where: {
//             OR: [
//                 {
//                     userId: userId,
//                     titleId: slug,
//                 },
//                 {
//                     authorUsername: userId,
//                     titleId: slug,
//                 },
//             ],
//         },
//     });
//     return {
//         title: `Edit Post: ${post?.title}`,
//         description: post?.description,
//         openGraph: { images: [post?.coverImage as string] },
//         authors: [{ name: post?.author }],
//     };
// }

export default async function EditPost({
    params,
}: {
    params: Promise<{ userId: string; slug: string }>;
}) {
    const { slug, userId } = await params;
    const session = await auth();
    if (!session?.user) redirect(signInUrl(`/${userId}/${slug}/edit`));

    const [post, user, tags] = await Promise.all([
        prisma.post.findFirst({
            where: { titleId: slug, userId: session.user.id },
            select: {
                id: true,
                title: true,
                description: true,
                content: true,
                tags: true,
                coverImage: true,
            },
        }),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                username: true,
            },
        }),
        getAllTags(),
    ]);
    if (!post) notFound();

    const postContent = {
        id: post.id,
        title: post.title,
        description: post.description,
        content: post.content as JSONContent,
        tags: post.tags,
        coverImage: post.coverImage as string,
        userId: session.user.id,
    };

    return (
        <Tiptap
            userId={user?.id}
            username={user?.username}
            editOrDraft={postContent}
            mode={"edit"}
            tags={tags}
        />
    );
}