import { Post } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";

export default function PostCard({ userId, authorUsername, titleId, coverImage, title, description }: Post) {
    return (<Link href={`/${authorUsername ? authorUsername : userId}/${titleId}`} target="_blank">
        <div className="card card-compact w-96 bg-base-100 shadow-xl">
            <figure>
                {coverImage ? (
                    <Image src={coverImage as string} alt="cover_image" width={1920} height={1080} />
                ) : (
                    // ponytail: no cover — gradient placeholder so the card
                    // keeps its layout. See PostContainer.tsx for the feed.
                    <div
                        className="w-full aspect-video bg-gradient-to-br from-base-300 via-base-200 to-base-300 flex items-center justify-center p-4"
                        aria-hidden="true"
                    >
                        <p className="text-base-content/50 text-lg font-bold text-center line-clamp-2">
                            {title}
                        </p>
                    </div>
                )}
            </figure>
            <div className="card-body">
                <h2 className="card-title">{title}</h2>
                <p>{description}</p>
            </div>
        </div>
    </Link>)
}