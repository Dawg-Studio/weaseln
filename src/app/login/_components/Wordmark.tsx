import Image from "next/image";
import Link from "next/link";
import { cn } from "@/utils/cn";

/* The full logo includes the mark, wordmark, and tagline on its own light
   textured field. It belongs in roomy brand surfaces like this one; compact
   slots use the transparent emblem cut instead (see Navigation.tsx). */
export default function Wordmark({ className }: { className?: string }) {
    return (
        <Link
            href="/"
            className={cn("-m-1 inline-flex rounded-field p-1 press", className)}
        >
            <span className="inline-flex overflow-hidden rounded-box">
                <Image
                    src="/weaseln.png"
                    alt="weaseln"
                    width={1448}
                    height={1086}
                    priority
                    className="h-auto w-56 sm:w-64"
                />
            </span>
        </Link>
    );
}
