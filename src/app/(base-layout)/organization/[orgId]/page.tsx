import UserOrgProfile from "@/components/user/UserOrgProfile";
import prisma from "@/db";

const OrgProfilePage = async ({
    params,
}: {
    params: Promise<{ orgId: string }>;
}) => {
    const { orgId } = await params;
    const org = await prisma.organization.findFirst({
        where: {
            OR: [
                {
                    id: orgId,
                },
                {
                    username: orgId, /// this ORG ID CAN BE USERNAME TOO
                },
            ],
        },
        include: {
            owner: { select: { username: true, name: true, image: true } },
            admins: { select: { username: true, name: true, image: true } },
            members: {
                select: { username: true, name: true, image: true },
            },
            _count: {
                select: {
                    posts: true,
                    members: true,
                },
            },
        },
    });
    if (!org) {
        return;
    }
    const posts = org._count.posts;
    const members = org._count.members;
    // ponytail: derive the role for every member from the org relations so the
    // profile UI can show owner/admin/member badges. Owner is rendered first.
    const orgMembers = [
        {
            username: org.owner.username,
            name: org.owner.name,
            image: org.owner.image,
            role: "owner" as const,
        },
        ...org.admins
            .filter((a) => a.username !== org.owner.username)
            .map((a) => ({
                username: a.username,
                name: a.name,
                image: a.image,
                role: "admin" as const,
            })),
        ...org.members
            .filter(
                (m) =>
                    m.username !== org.owner.username &&
                    !org.admins.some((a) => a.username === m.username),
            )
            .map((m) => ({
                username: m.username,
                name: m.name,
                image: m.image,
                role: "member" as const,
            })),
    ];
    return (
        <>
            <UserOrgProfile
                org={org}
                orgId={org.id as string}
                posts={posts}
                members={members}
                orgMembers={orgMembers}
            />
        </>
    );
};

export default OrgProfilePage;
