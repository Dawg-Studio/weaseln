import prisma from "@/db";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInUrl } from "@/utils/signInUrl";
import { listExperience } from "@/modules/portfolio/service";
import ResumePanel from "./_components/ResumePanel";
import ExperienceList, { type ExperienceRow } from "./_components/ExperienceList";

export default async function PortfolioSettingsPage() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/settings/portfolio"));

    const [user, experience] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { resumeUrl: true, resumePublic: true },
        }),
        listExperience({ userId: session.user.id }),
    ]);

    return (
        <div className="mx-auto lg:w-9/12 pt-6 space-y-6">
            <div>
                <Link href="/settings/portfolio/showcases" className="btn btn-primary btn-sm">
                    Showcases
                </Link>
                <p className="text-sm opacity-70 mt-2">
                    Build portfolio sections from your work, or start from your
                    resume.
                </p>
            </div>
            <ResumePanel
                initialPublic={user?.resumePublic ?? false}
                hasResume={Boolean(user?.resumeUrl)}
            />
            <ExperienceList initial={experience as ExperienceRow[]} />
        </div>
    );
}
