import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBirthdayCake,
    faBlog,
    faBriefcase,
    faHashtag,
    faLocationPin,
    faPeopleGroup,
    faThumbtack,
} from "@fortawesome/free-solid-svg-icons";
import type { FormSocials } from "@/types/user";
import { Fragment, Suspense } from "react";
import Link from "next/link";
import PostList from "@/components/post/PostList";
import Image from "next/image";
import QueryWrapper from "@/components/provider/QueryWrapper";
import { auth } from "@/auth";
import UserFollowButton from "@/components/user/actions/UserFollowButton";
import { Organization, User } from "@prisma/client";
import {
    normalizeProfileCustomization,
} from "@/modules/profile-customization/validation";
import type {
    BorderStyle,
    CardRadius,
    CardShadow,
    FontFamily,
    HeadingSize,
    ProfileCustomization,
    SpacingDensity,
    TextAlign,
} from "@/modules/profile-customization/types";

type OrgLite = {
    id: string;
    name: string;
    username: string;
    image: string;
};

const RADIUS_CLASS: Record<CardRadius, string> = {
    none: "rounded-none",
    small: "rounded-sm",
    medium: "rounded-md",
    large: "rounded-lg",
    full: "rounded-full",
};

const SHADOW_CLASS: Record<CardShadow, string> = {
    none: "shadow-none",
    subtle: "shadow-sm",
    medium: "shadow-md",
    large: "shadow-lg",
};

const BORDER_CLASS: Record<BorderStyle, string> = {
    none: "border-0",
    thin: "border",
    thick: "border-2",
};

const FONT_CLASS: Record<FontFamily, string> = {
    system: "font-sans",
    serif: "font-serif",
    sans: "font-sans",
    mono: "font-mono",
};

const HEADING_SIZE_CLASS: Record<HeadingSize, string> = {
    small: "text-2xl",
    medium: "text-3xl",
    large: "text-4xl",
};

const ALIGN_CLASS: Record<TextAlign, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

const SPACING_CLASS: Record<SpacingDensity, string> = {
    compact: "space-y-2",
    comfortable: "space-y-4",
    spacious: "space-y-6",
};

const UserOrgProfile = async ({
    user,
    userId,
    checkIfUserAlreadyFollowed,
    posts,
    followers,
    following,
    org,
    orgId,
    members,
    orgMembers,
    customization: customizationProp,
}: {
    user?: User;
    org?: Organization;
    userId?: string;
    checkIfUserAlreadyFollowed?: boolean;
    posts?: number;
    followers?: number;
    following?: number;
    orgId?: string;
    members?: number;
    orgMembers?: {
        username: string;
        name: string | null;
        image: string;
        role: "owner" | "admin" | "member";
    }[];
    customization?: ProfileCustomization | null;
}) => {
    const session = await auth();
    const customization = normalizeProfileCustomization(customizationProp);
    const visibleSections = customization.layout.sectionOrder.filter(
        (section) => !customization.layout.hiddenSections.includes(section),
    );
    const isWide = customization.layout.variant === "wide";

    const cardClasses = [
        RADIUS_CLASS[customization.cardRadius],
        SHADOW_CLASS[customization.cardShadow],
        BORDER_CLASS[customization.borderStyle],
        FONT_CLASS[customization.fontFamily],
        SPACING_CLASS[customization.spacingDensity],
    ].join(" ");

    const alignClasses = ALIGN_CLASS[customization.textAlign];

    const containerStyle: React.CSSProperties = {
        backgroundColor: customization.backgroundColor ?? undefined,
        color: customization.textColor ?? undefined,
        ...(customization.backgroundImage
            ? {
                  backgroundImage: `url(${JSON.stringify(customization.backgroundImage)})`,
                  backgroundSize: customization.backgroundSize,
                  backgroundPosition: customization.backgroundPosition,
                  backgroundRepeat: "no-repeat",
              }
            : {}),
    };

    const containerClass = isWide
        ? "mx-auto mb-12 mt-12 mr-4 ml-4 lg:mr-28 lg:ml-28 max-w-none"
        : "mx-auto mb-12 mt-12 mr-4 ml-4 lg:mr-28 lg:ml-28";

    const isAboutVisible = visibleSections.includes("about");
    const userOrgs = (user as (User & { organizations?: OrgLite[] }) | undefined)
        ?.organizations;
    const hasInterests =
        Array.isArray(user?.interests) && user.interests.length > 0;
    const hasPinnedPost = Boolean(user?.pinned);
    const hasUserOrganizations =
        Array.isArray(userOrgs) && userOrgs.length > 0;
    const socialsList = (user?.socials as FormSocials[]) ??
        (org?.socials as FormSocials[]) ?? [];
    const hasSocials = socialsList.some((social) => social?.url !== "");

    const renderHero = () => (
        <div
            className={`relative container p-4 mt-8 mb-8 mx-auto ${cardClasses} ${alignClasses}`}
        >
            <div className="avatar flex justify-center mb-4">
                <div className="lg:w-64 w-32 rounded-full">
                    <Image
                        src={user?.image ?? (org?.image as string)}
                        alt={user?.name as string}
                        height={150}
                        width={150}
                        priority
                    />
                </div>
            </div>
            <div className="flex items-center justify-center space-x-4">
                <div className="relative text-center space-y-2 w-1/2">
                    <h3
                        className={`font-bold ${HEADING_SIZE_CLASS[customization.headingSize]}`}
                    >
                        {user && user.name ? user.name : org?.name}
                    </h3>
                    {isAboutVisible && (
                        <>
                            <p className="text-lg">
                                {user ? user.bio : org?.username}
                            </p>
                            <p className="text-xs ">
                                {user && user.address && (
                                    <>
                                        <FontAwesomeIcon icon={faLocationPin} />{" "}
                                        {user.address}, &nbsp;{" "}
                                    </>
                                )}{" "}
                                <FontAwesomeIcon icon={faBirthdayCake} />
                                &nbsp;
                                {user ? (
                                    <span>
                                        {" "}
                                        Joined on{" "}
                                        {new Date(
                                            user.createdAt,
                                        ).toDateString()}
                                    </span>
                                ) : org ? (
                                    <span>
                                        Created on{" "}
                                        {new Date(
                                            org.createdAt,
                                        ).toDateString()}{" "}
                                    </span>
                                ) : null}
                            </p>
                        </>
                    )}
                    {!isAboutVisible && user && (
                        <p className="text-xs ">
                            <FontAwesomeIcon icon={faBirthdayCake} />
                            &nbsp;
                            <span>
                                {" "}
                                Joined on{" "}
                                {new Date(user.createdAt).toDateString()}
                            </span>
                        </p>
                    )}
                    {!isAboutVisible && org && (
                        <p className="text-xs ">
                            Created on {new Date(org.createdAt).toDateString()}{" "}
                        </p>
                    )}
                    {hasInterests && visibleSections.includes("interests") && (
                        <div
                            className="flex flex-wrap justify-center gap-2 pt-2"
                            data-testid="interests"
                        >
                            {user?.interests.map((interest) => (
                                <Link
                                    key={interest}
                                    href={`/tag/${interest}`}
                                    className={`badge badge-soft badge-sm gap-1 ${RADIUS_CLASS[customization.cardRadius]} hover:badge-primary transition-colors`}
                                    aria-label={`View posts tagged ${interest}`}
                                >
                                    <FontAwesomeIcon
                                        icon={faHashtag}
                                        className="w-3 h-3 opacity-70"
                                        aria-hidden="true"
                                    />
                                    {interest}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {user && session && session.user.id !== user.id && (
                <div className="flex justify-center mt-2 lg:flex-none lg:mt-0">
                    <div className="lg:block lg:absolute top-5 right-5">
                        <UserFollowButton
                            userId={user.id}
                            initialFollowStatus={
                                checkIfUserAlreadyFollowed as boolean
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const renderStats = () => (
        <div className={`p-4 ${cardClasses} ${alignClasses}`}>
            <div className="flex items-center space-x-4">
                <FontAwesomeIcon width={24} icon={faBlog} size="lg" />
                <p className="text-lg ">{posts} posts posted</p>
            </div>
            <div className="flex items-center space-x-4">
                <FontAwesomeIcon width={24} icon={faPeopleGroup} size="lg" />
                <p className="text-lg ">
                    {user
                        ? `${followers} followers`
                        : `${members} members`}
                </p>
            </div>
            {user && (
                <div className="flex items-center space-x-4">
                    <FontAwesomeIcon width={24} icon={faPeopleGroup} size="lg" />
                    <p className="text-lg ">{following} following</p>
                </div>
            )}
            {user && user.occupation && (
                <div className="flex items-center space-x-4">
                    <FontAwesomeIcon width={24} icon={faBriefcase} size="lg" />
                    <p className="text-lg">{user.occupation}</p>
                </div>
            )}
        </div>
    );

    const renderSocials = () => {
        if (!hasSocials) return null;
        return (
            <div className={`p-4 ${cardClasses} ${alignClasses}`}>
                <p className="text-xl">Social Links: </p>
                <ul className="list-disc ml-12">
                    {socialsList.map((social) => (
                        <Fragment key={social.name}>
                            {social.url && (
                                <li className="text-md">
                                    <Link
                                        href={
                                            social.url.includes("http://") ||
                                            social.url.includes("https://")
                                                ? social.url
                                                : `https://${social.url}`
                                        }
                                        target="_blank"
                                    >
                                        {" "}
                                        {social.name}{" "}
                                    </Link>
                                </li>
                            )}
                        </Fragment>
                    ))}
                </ul>
            </div>
        );
    };

    const renderFeaturedPost = () => {
        if (!hasPinnedPost) return null;
        return (
            <div
                className={`p-4 ${cardClasses} ${alignClasses}`}
                data-testid="featured-post"
            >
                <p className="text-xl font-bold flex items-center gap-2">
                    <FontAwesomeIcon icon={faThumbtack} />
                    Featured Post
                </p>
                <p className="text-md mt-2">
                    Pinned post id: {user?.pinned}
                </p>
            </div>
        );
    };

    const renderUserOrganizations = () => {
        if (!hasUserOrganizations) return null;
        return (
            <div
                className={`p-4 ${cardClasses} ${alignClasses}`}
                data-testid="user-organizations"
            >
                <p className="text-xl font-bold mb-4">Organizations</p>
                <ul className="space-y-2">
                    {userOrgs!.map((o) => (
                        <li
                            key={o.username}
                            className="flex items-center gap-3"
                        >
                            <Link
                                href={`/organization/${o.username}`}
                                className="flex items-center gap-3"
                            >
                                <Image
                                    src={o.image}
                                    alt={o.name ?? o.username}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                                <span className="font-medium">
                                    {o.name ?? o.username}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderPosts = () => (
        <div className="w-full">
            {posts === 0 && (
                <div className="flex items-center md:justify-normal justify-center font-bold text-gray-600 w-full h-full md:ml-[400px] md:text-xl text-md">
                    <span>No post from user yet</span>
                </div>
            )}
            <QueryWrapper>
                <Suspense>
                    <PostList userId={userId} orgId={orgId} />
                </Suspense>
            </QueryWrapper>
        </div>
    );

    const renderOrgMembers = () => {
        // ponytail: org-members is rendered as a separate block (not a section
        // in sectionOrder) so hiding the "posts" section on an org profile
        // can't take the members list with it.
        if (!org || !orgMembers || orgMembers.length === 0) return null;
        return (
            <div
                data-testid="org-members"
                className={`mb-6 p-6 ${cardClasses}`}
            >
                <p className="text-xl font-bold mb-4">Members</p>
                <ul className="space-y-2">
                    {orgMembers.map((m) => (
                        <li
                            key={m.username}
                            className="flex items-center gap-3"
                        >
                            <Link
                                href={`/${m.username}`}
                                className="flex items-center gap-3"
                            >
                                <Image
                                    src={m.image}
                                    alt={m.name ?? m.username}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                                <span className="font-medium">
                                    {m.name ?? m.username}
                                </span>
                            </Link>
                            <span
                                className="text-xs px-2 py-0.5 rounded bg-base-300 uppercase"
                                data-testid={`org-role-${m.username}`}
                            >
                                {m.role}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderers: Record<string, () => React.ReactNode> = {
        hero: renderHero,
        stats: renderStats,
        socials: renderSocials,
        featuredPost: renderFeaturedPost,
        organizations: renderUserOrganizations,
        posts: renderPosts,
    };

    const statsVisible = visibleSections.includes("stats");
    const socialsVisible = visibleSections.includes("socials");
    const useSidebarLayout =
        customization.layout.variant === "wide"
            ? false
            : customization.layout.variant === "sidebar"
              ? true
              : statsVisible || socialsVisible;

    if (useSidebarLayout) {
        const sidebarSections = visibleSections.filter(
            (s) => s === "stats" || s === "socials",
        );
        const mainSections = visibleSections.filter(
            (s) => s !== "hero" && s !== "stats" && s !== "socials",
        );
        return (
            <div className={containerClass} style={containerStyle}>
                {/* Sidebar mode intentionally pins hero above the sidebar+main
                    flex wrapper. The two-column layout (sidebar | main) requires
                    hero as a banner row above the columns; reordering hero into
                    the main column would break the visual hierarchy. The
                    "wide" and "standard" variants below render hero via the
                    sectioned flow, so hero is user-reorderable there. */}
                {visibleSections.includes("hero") && (
                    <Fragment key="hero">{renderHero()}</Fragment>
                )}
                <div className="flex flex-wrap mx-auto lg:flex-nowrap md:space-x-12 md:space-y-0">
                    <div
                        className={`lg:w-1/4 mx-auto h-2/4 md:sticky top-24 p-12 mb-12 lg:mb-0 ${SPACING_CLASS[customization.spacingDensity]} ${alignClasses}`}
                    >
                        {sidebarSections.map((s) => (
                            <Fragment key={s}>{renderers[s]?.()}</Fragment>
                        ))}
                    </div>
                    <div className="w-full">
                        {mainSections.map((s) => (
                            <Fragment key={s}>{renderers[s]?.()}</Fragment>
                        ))}
                        {renderOrgMembers()}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={containerClass} style={containerStyle}>
            {visibleSections.map((s) => (
                <Fragment key={s}>{renderers[s]?.()}</Fragment>
            ))}
            {renderOrgMembers()}
        </div>
    );
};

export default UserOrgProfile;