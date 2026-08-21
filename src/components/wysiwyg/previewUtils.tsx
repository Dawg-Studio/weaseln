"use client";

import NextImage from "next/image";
import Link from "next/link";
import parse from "html-react-parser";
import { Fragment } from "react";
import { useEditor } from "@tiptap/react";

const prose =
    "prose prose-sm sm:prose lg:prose-lg measure reading mx-auto my-8 px-4 sm:px-6 focus:outline-none";

export function PreviewEditor({
    editor,
    editorTitle,
    editorDescription,
    coverImage,
    inputTags,
}: {
    editor: ReturnType<typeof useEditor>;
    editorTitle: ReturnType<typeof useEditor>;
    editorDescription: ReturnType<typeof useEditor>;
    coverImage: string;
    inputTags: string[];
}) {
    const renderHtml = editor?.getHTML() as string;
    return (
        <section className={prose}>
            {coverImage && (
                <figure className="not-prose relative my-8 overflow-hidden rounded-box border border-hairline bg-base-200 elev-1">
                    <NextImage
                        src={coverImage}
                        height={1920}
                        width={1080}
                        alt="cover"
                        className="cover-crop"
                    />
                </figure>
            )}
            <div className="container -space-y-6">
                <h1 className="text-title text-base-content lg:text-display">
                    {editorTitle?.getText()}
                </h1>
                <h4 className="text-subhead text-muted">
                    {editorDescription?.getText()}
                </h4>
                <br />
            </div>
            <p className="text-sm text-base-content">
                <strong>[Your Name]</strong> · [number] min read
            </p>
            <p className="text-meta text-muted nums">
                Posted on {new Date().toDateString()}
            </p>
            {inputTags.length !== 0 && (
                <div className="not-prose flex flex-wrap gap-2">
                    {inputTags.map((tag: string, index: number) => (
                        <Fragment key={index}>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-base-300 px-2.5 py-1 text-meta font-medium text-base-content/80 transition-colors duration-150 hover:border-primary/45 hover:bg-tint hover:text-base-content focus-ring"
                            >
                                #{tag}
                            </Link>
                        </Fragment>
                    ))}
                </div>
            )}
            <hr className="my-8 h-px w-full border-0 bg-hairline" />
            {parse(`${renderHtml}`)}
        </section>
    );
}

export async function urlToFile(
    url: string,
    name: string,
): Promise<File | null> {
    try {
        const blob = await fetch(url).then((r) => r.blob());
        return new File([blob], name, { type: blob.type || "image/png" });
    } catch {
        return null;
    }
}

export async function collectEditorImages(
    editor: ReturnType<typeof useEditor>,
): Promise<File[]> {
    const json = editor?.getJSON();
    const editorImages = json?.content?.filter(
        (image: { type?: string }) => image.type === "image",
    );
    if (!editorImages) return [];
    const images: File[] = [];
    for (const [index, image] of Object.entries(editorImages)) {
        const src = (image as { attrs?: { src?: string } })?.attrs?.src;
        if (!src) continue;
        const file = await urlToFile(src, `img_${index}`);
        if (file) images.push(file);
    }
    return images;
}
