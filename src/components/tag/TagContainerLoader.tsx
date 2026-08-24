import { cn } from "@/utils/cn";

// Mirrors the TagContainer chip silhouette exactly (h-9 pill, mixed widths) so
// nothing reflows when the real chips land.
const CHIP_WIDTHS = [
    "w-28",
    "w-36",
    "w-24",
    "w-32",
    "w-40",
    "w-28",
    "w-24",
    "w-36",
];

export default function TagContainerLoader() {
    return (
        <>
            <span className="sr-only">Loading tags</span>
            <div aria-hidden="true" className="flex w-full flex-wrap gap-2.5">
                {CHIP_WIDTHS.map((width, index) => (
                    <div
                        key={index}
                        className={cn("shimmer h-9 rounded-full", width)}
                    />
                ))}
            </div>
        </>
    );
}
