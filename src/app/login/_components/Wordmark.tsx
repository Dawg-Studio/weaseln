import Image from "next/image";
import Link from "next/link";
import { cn } from "@/utils/cn";

/* /icons/weaslnnobg.png is the brand lockup on a transparent field: the W mark
   in its brush ring, the "Weasln" wordmark, and the tagline, all in one raster.

   Because the wordmark is already inside the artwork, nothing is set beside it
   here — a CSS "weaseln." next to this would print the name twice. It is also
   why it is sized by width rather than dropped to nav height: at ~36px the
   baked-in tagline collapses into mush, so the lockup gets room to read.

   Dark theme: the wordmark and tagline are inked near-black in the raster and
   all but vanish on the dark canvas (base-100 is oklch 19%). The artwork cannot
   be recoloured — it is a flat PNG — so under [data-theme="dark"] it sits on a
   cream plate instead. That keeps the brush ring, the yellow dot and the leaf
   at their true brand colours, which a filter-based fix (invert/brightness)
   would destroy. Cream is the brand canvas #FBF8F0 from docs/ASSETS.md; there
   is no theme token for it in dark, where every surface token is dark by
   design. */
export default function Wordmark({ className }: { className?: string }) {
    return (
        <Link
            href="/"
            className={cn("-m-1 inline-flex rounded-field p-1 press", className)}
        >
            <span className="inline-flex rounded-box dark:bg-[#FBF8F0] dark:p-3 dark:elev-1">
                <Image
                    src="/icons/weaslnnobg.png"
                    alt="weaseln"
                    width={1536}
                    height={1024}
                    priority
                    className="h-auto w-40 sm:w-44"
                />
            </span>
        </Link>
    );
}
