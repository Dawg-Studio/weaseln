"use client";

import { User } from "@/generated/prisma/client";
import Image from "next/image";
import Link from "next/link";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function PeopleContainer({
    name,
    username,
    image,
    id,
    bio,
}: User) {
    return (
        <Link href={`/${username || id}`} className="group block rounded-box">
            <div className="lift flex items-start gap-4 rounded-box border border-hairline bg-surface elev-1 p-4 sm:p-5">
                <div className="avatar self-start">
                    <div className="w-16 rounded-full ring-2 ring-primary/25 ring-offset-2 ring-offset-surface transition-[box-shadow] duration-200 group-hover:ring-primary/55">
                        <Image
                            src={image}
                            width={70}
                            height={70}
                            alt={name as string}
                        />
                    </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="truncate text-headline text-base-content transition-colors duration-150 group-hover:text-primary">
                        {name}
                    </h3>
                    {username && (
                        <p className="nums truncate text-meta text-muted">
                            @{username}
                        </p>
                    )}
                    {bio && (
                        <p className="line-clamp-2 pt-0.5 text-sm text-base-content/70">
                            {bio}
                        </p>
                    )}
                </div>
                <span
                    aria-hidden="true"
                    className="mt-1 hidden shrink-0 text-muted transition-colors duration-200 group-hover:text-primary sm:block"
                >
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        width={14}
                        className="w-3.5 transition-transform duration-200 ease-burrow group-hover:translate-x-0.5"
                    />
                </span>
            </div>
        </Link>
    );
}
