import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const SEEDED_EMAILS = ["alice@test.com", "bob@test.com", "carol@test.com"] as const;
const SEEDED_ORG_USERNAME = "weaseln-test-org";

// ponytail: explicit follow pairs — written to users._UserFollows directly via
// $executeRaw. Using the implicit M2M `following.connect(...)` form silently
// drops one of the six rows Prisma tries to insert, so this is the only way
// to guarantee the seeded counts documented in docs/QA.md §1.
//
// The tuple order is (followee, follower): in Prisma's implicit M2M with
// `followedBy User[]` declared first (column A) and `following User[]`
// declared second (column B), the A column is the user being followed and
// the B column is the user doing the following. Verified empirically with
// qa-probe-follows.ts.
const SEEDED_FOLLOWS: ReadonlyArray<readonly [string, string]> = [
    ["bob", "alice"], // alice follows bob
    ["carol", "alice"], // alice follows carol
    ["alice", "bob"], // bob follows alice
    ["alice", "carol"], // carol follows alice
    ["bob", "carol"], // carol follows bob
];

const avatar = (seed: string) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

const doc = (text: string): Prisma.InputJsonValue => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function main() {
    // Wipe in dependency order. Composite FK Post.(userId,author,authorImage) →
    // User.(id,name,image) has no onDelete, so posts must go before users.
    // Cascading clears PostComment / PostReaction / PostView / reading history.
    // Ownership-based cleanup also removes legacy fixtures created by these
    // dedicated QA accounts without retaining old-brand identifiers.
    const seededUserIds = (
        await prisma.user.findMany({
            where: { email: { in: [...SEEDED_EMAILS] } },
            select: { id: true },
        })
    ).map(({ id }) => id);
    await prisma.post.deleteMany({
        where: { userId: { in: seededUserIds } },
    });
    await prisma.organization.deleteMany({
        where: { ownerId: { in: seededUserIds } },
    });
    await prisma.user.deleteMany({
        where: { email: { in: [...SEEDED_EMAILS] } },
    });

    const [alice, bob, carol] = await Promise.all([
        prisma.user.create({
            data: {
                email: "alice@test.com",
                emailVerified: new Date(),
                username: "alice",
                name: "Alice Anderson",
                image: avatar("alice"),
                bio: "QA seed user — Alice.",
                // ponytail: seed a few interests so the trending-tags sidebar
                // and tag pages show non-zero follower counts during QA.
                interests: ["design", "ux", "intro", "platform"],
            },
        }),
        prisma.user.create({
            data: {
                email: "bob@test.com",
                emailVerified: new Date(),
                username: "bob",
                name: "Bob Brown",
                image: avatar("bob"),
                bio: "QA seed user — Bob.",
                interests: ["writing", "industry", "personal"],
            },
        }),
        prisma.user.create({
            data: {
                email: "carol@test.com",
                emailVerified: new Date(),
                username: "carol",
                name: "Carol Carter",
                image: avatar("carol"),
                bio: "QA seed user — Carol.",
                interests: ["ux", "reading", "comments", "community", "notifications"],
            },
        }),
    ]);

    const org = await prisma.organization.create({
        data: {
            name: "Weaseln Test Org",
            username: SEEDED_ORG_USERNAME,
            image: avatar("weaseln-org"),
            secret: crypto.randomUUID(),
            summary: "Organization used by the QA seed.",
            ownerId: alice.id,
            admins: { connect: [{ id: bob.id }] },
            members: { connect: [{ id: bob.id }, { id: carol.id }] },
            socials: [],
        },
    });

    const postSpecs = [
        { titleId: "welcome-to-weaseln", author: alice, title: "Welcome to weaseln", description: "An intro post for the QA seed.", tags: ["intro", "platform"], published: true, orgId: org.id, cover: "/covers/cover-1.svg" },
        { titleId: "designing-for-readers", author: alice, title: "Designing for Readers", description: "Notes on reader-first design.", tags: ["design", "ux"], published: true, orgId: org.id, cover: "/covers/cover-2.svg" },
        { titleId: "the-state-of-blogging", author: bob, title: "The State of Blogging", description: "Where blogging is heading.", tags: ["writing", "industry"], published: true, orgId: null, cover: "/covers/cover-3.svg" },
        { titleId: "comment-as-feature", author: carol, title: "Comment as Feature", description: "Why comments still matter.", tags: ["comments", "community"], published: true, orgId: null, cover: "/covers/cover-4.svg" },
        { titleId: "reading-history-ux", author: carol, title: "Reading History UX", description: "Designing a calm reading history.", tags: ["ux", "reading"], published: true, orgId: org.id, cover: "/covers/cover-1.svg" },
        { titleId: "api-keys-explained", author: alice, title: "API Keys, Explained", description: "How weaseln API keys work.", tags: ["api", "docs"], published: true, orgId: null, cover: "/covers/cover-2.svg" },
        { titleId: "why-i-write-here", author: bob, title: "Why I Write Here", description: "A short note on why.", tags: ["writing", "personal"], published: true, orgId: null, cover: "/covers/cover-3.svg" },
        { titleId: "notes-on-notifications", author: carol, title: "Notes on Notifications", description: "Notification design that respects attention.", tags: ["notifications"], published: true, orgId: null, cover: "/covers/cover-4.svg" },
        { titleId: "starting-threads", author: alice, title: "Starting Threads", description: "How to seed a good discussion.", tags: ["comments"], published: true, orgId: org.id, cover: "/covers/cover-1.svg" },
        { titleId: "draft-wip", author: bob, title: "Work in Progress", description: "This is a draft.", tags: ["wip"], published: false, orgId: null, cover: null },
    ];

    const posts = await Promise.all(
        postSpecs.map((p) =>
            prisma.post.create({
                data: {
                    userId: p.author.id,
                    author: p.author.name!,
                    authorUsername: p.author.username,
                    authorImage: p.author.image,
                    title: p.title,
                    titleId: p.titleId,
                    description: p.description,
                    content: doc(p.description),
                    tags: p.tags,
                    readPerMinute: 1,
                    published: p.published,
                    organizationId: p.orgId,
                    coverImage: p.cover,
                },
            }),
        ),
    );

    const [topPost, secondPost, thirdPost] = posts;

    const topComment = await prisma.postComment.create({
        data: {
            postId: topPost.id,
            userId: bob.id,
            userName: bob.name!,
            userUsername: bob.username,
            userImage: bob.image,
            content: doc("Great intro — looking forward to more."),
        },
    });
    await prisma.postComment.create({
        data: {
            postId: topPost.id,
            userId: alice.id,
            userName: alice.name!,
            userUsername: alice.username,
            userImage: alice.image,
            content: doc("Thanks Bob!"),
            postCommentReplyId: topComment.id,
        },
    });
    await prisma.postComment.create({
        data: {
            postId: secondPost.id,
            userId: carol.id,
            userName: carol.name!,
            userUsername: carol.username,
            userImage: carol.image,
            content: doc("I love how this focuses on the reader."),
        },
    });
    await prisma.postComment.create({
        data: {
            postId: thirdPost.id,
            userId: alice.id,
            userName: alice.name!,
            userUsername: alice.username,
            userImage: alice.image,
            content: doc("Where do you see this going in five years?"),
        },
    });

    await prisma.postReaction.createMany({
        data: [
            { postId: topPost.id, userId: bob.id, userName: bob.name!, userImage: bob.image, type: "like" },
            { postId: topPost.id, userId: carol.id, userName: carol.name!, userImage: carol.image, type: "like" },
            { postId: secondPost.id, userId: alice.id, userName: alice.name!, userImage: alice.image, type: "like" },
            { postId: posts[4].id, userId: bob.id, userName: bob.name!, userImage: bob.image, type: "like" },
        ],
    });

    // ponytail: insert follow rows directly. See SEEDED_FOLLOWS comment above
    // for why we don't use `following.connect` here.
    const userByUsername = new Map([
        ["alice", alice],
        ["bob", bob],
        ["carol", carol],
    ]);
    for (const [followeeUsername, followerUsername] of SEEDED_FOLLOWS) {
        const followee = userByUsername.get(followeeUsername);
        const follower = userByUsername.get(followerUsername);
        if (!follower || !followee) continue;
        await prisma.$executeRaw`
            INSERT INTO users."_UserFollows" ("A", "B")
            VALUES (${followee.id}, ${follower.id})
            ON CONFLICT ("A", "B") DO NOTHING
        `;
    }

    await prisma.post.update({
        where: { id: posts[0].id },
        data: { isBookmarkedBy: { connect: [{ id: alice.id }] } },
    });
    await prisma.post.update({
        where: { id: posts[2].id },
        data: { isBookmarkedBy: { connect: [{ id: alice.id }] } },
    });

    console.log(
        `Seeded: 3 users, 1 org, ${posts.length} posts, 4 comments, 4 reactions, follows, 2 bookmarks.`,
    );
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
