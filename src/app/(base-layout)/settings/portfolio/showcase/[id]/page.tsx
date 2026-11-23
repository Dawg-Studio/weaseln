import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import prisma from "@/db";
import { auth } from "@/auth";
import { signInUrl } from "@/utils/signInUrl";
import type { ShowcaseLayout } from "@/modules/portfolio/types";
import { normalizeShowcaseLayout } from "@/modules/portfolio/validation";
import ShowcaseEditor from "./_components/ShowcaseEditor";

export default async function ShowcaseEditorPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/settings/portfolio/showcases"));

    const { id } = await params;
    const [showcase, user] = await Promise.all([
        prisma.portfolioShowcase.findFirst({
            where: { id, userId: session.user.id },
            include: { items: { orderBy: { order: "asc" } } },
        }),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { username: true },
        }),
    ]);

    // Another user's id reads as missing, never as a permission error.
    if (!showcase) notFound();

    return (
        <div className="mx-auto lg:w-9/12 pt-6 space-y-6">
            <Link
                href="/settings/portfolio/showcases"
                className="link link-hover text-sm"
            >
                ← Showcases
            </Link>
            <h1 className="text-2xl font-bold">{showcase.title}</h1>
            <ShowcaseEditor
                showcase={{
                    id: showcase.id,
                    title: showcase.title,
                    slug: showcase.slug,
                    description: showcase.description,
                    layout: normalizeShowcaseLayout(showcase.layout) as ShowcaseLayout,
                }}
                items={showcase.items}
                userId={session.user.id}
                username={user?.username ?? ""}
            />
        </div>
    );
}
