import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBirthdayCake,
    faBlog,
    faBriefcase,
    faLocationPin,
    faPeopleGroup,
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
    orgMembers?: { username: string; name: string | null; image: string; role: "owner" | "admin" | "member" }[];
}) => {
    const session = await auth();
    return (
        <>
            <div className="mx-auto mb-12 mt-12 mr-4 ml-4 lg:mr-28 lg:ml-28">
                <div className="relative container p-4 mt-8 mb-8 rounded shadow-md mx-auto">
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
                            <h3 className=" text-4xl font-bold">
                                {user && user.name ? user.name : org?.name}
                            </h3>
                            <p className="text-lg">{user ? user.bio : org?.username}</p>
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
                                        Created on {" "}
                                        {new Date(org.createdAt).toDateString()}{" "}
                                    </span>
                                ) : null}
                            </p>
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
                <div className="flex flex-wrap mx-auto lg:flex-nowrap md:space-x-12 md:space-y-0">
                    <div className="lg:w-1/4 mx-auto rounded shadow-md h-2/4 md:sticky top-24 p-12 space-y-4 mb-12 lg:mb-0">
                        <div className="flex item-center space-x-4">
                            <FontAwesomeIcon
                                width={24}
                                icon={faBlog}
                                size="lg"
                            />
                            <p className="text-lg ">{posts} posts posted</p>
                        </div>
                        <div className="flex item-center space-x-4">
                            <FontAwesomeIcon
                                width={24}
                                icon={faPeopleGroup}
                                size="lg"
                            />
                            <p className="text-lg ">
                                {user
                                    ? `${followers} followers`
                                    : `${members} members`}
                            </p>
                        </div>
                        {user && (
                            <div className="flex item-center space-x-4">
                                <FontAwesomeIcon
                                    width={24}
                                    icon={faPeopleGroup}
                                    size="lg"
                                />
                                <p className="text-lg ">
                                    {following} following
                                </p>
                            </div>
                        )}
                        {user && user.occupation && (
                            <div className="flex item-center space-x-4">
                                <FontAwesomeIcon
                                    width={24}
                                    icon={faBriefcase}
                                    size="lg"
                                />
                                <p className="text-lg">{user.occupation}</p>
                            </div>
                        )}
                        {(
                            (user?.socials as FormSocials[]) ??
                            (org?.socials as FormSocials[])
                        ).find((social) => social?.url !== "") && (
                            <>
                                <p className="text-xl">Social Links: </p>
                                <ul className="list-disc ml-12">
                                    {(
                                        (user?.socials as FormSocials[]) ??
                                        (org?.socials as FormSocials[])
                                    ).map((social) => (
                                        <Fragment key={social.name}>
                                            {social.url && (
                                                <li className="text-md">
                                                    <Link
                                                        href={
                                                            social.url.includes(
                                                                "http://",
                                                            ) ||
                                                            social.url.includes(
                                                                "https://",
                                                            )
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
                            </>
                        )}
                    </div>
                    <div className="w-full">
                        {posts === 0 && (
                            <div className="flex items-center md:justify-normal justify-center font-bold text-gray-600 w-full h-full md:ml-[400px] md:text-xl text-md">
                                <span>No post from user yet</span>
                            </div>
                        )}
                        {org && orgMembers && orgMembers.length > 0 && (
                            <div
                                data-testid="org-members"
                                className="mb-6 p-6 rounded shadow-md"
                            >
                                <p className="text-xl font-bold mb-4">
                                    Members
                                </p>
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
                        )}
                        <QueryWrapper>
                            <Suspense>
                                <PostList userId={userId} orgId={orgId} />
                            </Suspense>
                        </QueryWrapper>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserOrgProfile;
