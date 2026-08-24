import { TagRank } from "@/types/tag";
import Link from "next/link";

export default function TagContainer({ tag, usage }: TagRank) {
    return (
        <Link
            href={`/tag/${tag}`}
            className="group inline-flex max-w-full rounded-full"
        >
            <button className="press inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-base-200 py-2 pl-3 pr-2 text-sm font-medium text-base-content/85 transition-[background-color,border-color,color,box-shadow] duration-150 group-hover:border-primary/45 group-hover:bg-tint group-hover:text-base-content">
                <span
                    aria-hidden="true"
                    className="text-base font-bold leading-none text-muted transition-colors duration-150 group-hover:text-primary"
                >
                    #
                </span>
                <span className="min-w-0 truncate">{tag}</span>
                <span className="nums grid h-5 min-w-6 shrink-0 place-items-center rounded-full bg-base-300 px-1.5 text-eyebrow text-muted transition-colors duration-150 group-hover:bg-tint-strong group-hover:text-base-content">
                    {usage}
                </span>
            </button>
        </Link>
    );
}
