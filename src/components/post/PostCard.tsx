import { Post } from "@/generated/prisma/client";
import Link from "next/link";
import Image from "next/image";

export default function PostCard({
    userId,
    authorUsername,
    titleId,
    coverImage,
    title,
    description,
}: Post) {
    return (
        <Link
            href={`/${authorUsername ? authorUsername : userId}/${titleId}`}
            target="_blank"
            className="group block w-full max-w-sm rounded-box"
        >
            <div className="card card-compact h-full w-full overflow-hidden rounded-box border border-hairline bg-surface elev-1 lift">
                {coverImage && (
                    <figure className="relative overflow-hidden bg-base-200">
                        <Image
                            src={coverImage as string}
                            alt="cover_image"
                            width={1920}
                            height={1080}
                            className="cover-crop transition-transform duration-500 ease-out-quint group-hover:scale-[1.03]"
                        />
                    </figure>
                )}
                <div className="card-body gap-2 p-4">
                    <h2 className="card-title line-clamp-2 text-headline text-base-content transition-colors duration-150 group-hover:text-primary">
                        {title}
                    </h2>
                    <p className="line-clamp-3 text-sm text-base-content/70">
                        {description}
                    </p>
                </div>
            </div>
        </Link>
    );
}
