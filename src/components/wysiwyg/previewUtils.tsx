"use client";

import NextImage from "next/image";
import Link from "next/link";
import parse from "html-react-parser";
import { Fragment } from "react";
import { useEditor } from "@tiptap/react";

const prose =
    "prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto mt-8 mb-8 mr-4 ml-4 sm:mr-auto sm:ml-auto max-w-md focus:outline-none";

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
                <NextImage
                    src={coverImage}
                    height={1920}
                    width={1080}
                    alt="cover"
                />
            )}
            <div className="container -space-y-6">
                <h1>{editorTitle?.getText()}</h1>
                <h4 className="!text-slate-600">
                    {editorDescription?.getText()}
                </h4>
                <br />
            </div>
            <p>
                <strong>[Your Name]</strong> · [number] min read
            </p>
            <p className=" text-xs">
                Posted on {new Date().toDateString()}
            </p>
            {inputTags.length !== 0 && (
                <div className="flex space-x-4">
                    {inputTags.map((tag: string, index: number) => (
                        <Fragment key={index}>
                            <Link href="/">
                                <p className="text-sm">#{tag}</p>
                            </Link>
                        </Fragment>
                    ))}
                </div>
            )}
            <div className="divider divider-vertical"></div>
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
