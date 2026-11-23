import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInUrl } from "@/utils/signInUrl";
import { listShowcases } from "@/modules/portfolio/service";
import ShowcasesList, { type ShowcaseListItem } from "./_components/ShowcasesList";

export default async function ShowcasesSettingsPage() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/settings/portfolio/showcases"));

    const showcases = await listShowcases({ userId: session.user.id });

    return (
        <div className="mx-auto lg:w-9/12 pt-6 space-y-6">
            <div>
                <Link href="/settings/portfolio" className="link link-hover text-sm">
                    ← Portfolio settings
                </Link>
                <h1 className="text-2xl font-bold mt-2">Showcases</h1>
                <p className="text-sm opacity-70">
                    Each showcase is a section of your profile. Pick a layout
                    that suits the work.
                </p>
            </div>
            <ShowcasesList initial={showcases as ShowcaseListItem[]} />
        </div>
    );
}
