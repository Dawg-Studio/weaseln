"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import type { ItemInput } from "@/modules/portfolio/types";
import { MAX_GALLERY_IMAGES } from "@/modules/portfolio/types";
import { requestOrToast } from "@/utils/requestOrToast";

type EditableItem = ItemInput & { id: string };

const EMPTY_ITEM: ItemInput = {
    title: "",
    summary: null,
    description: null,
    coverImage: null,
    gallery: [],
    link: null,
    tags: [],
    date: null,
};

async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch("/api/portfolio/image", {
        method: "POST",
        body: form,
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Upload failed");
    }
    return body.url;
}

export default function ItemEditor({
    showcaseId,
    item,
    onDone,
}: {
    showcaseId: string;
    item?: EditableItem;
    onDone?: () => void;
}) {
    const router = useRouter();
    const [draft, setDraft] = useState<ItemInput>(item ?? EMPTY_ITEM);
    const [busy, setBusy] = useState(false);
    const atGalleryCap = draft.gallery.length >= MAX_GALLERY_IMAGES;

    async function addToGallery(file: File | undefined, field: "coverImage" | "gallery") {
        if (!file) return;
        setBusy(true);
        try {
            const url = await uploadImage(file);
            setDraft((current) =>
                field === "coverImage"
                    ? { ...current, coverImage: url }
                    : { ...current, gallery: [...current.gallery, url] },
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setBusy(false);
        }
    }

    async function save() {
        setBusy(true);
        try {
            const response = await requestOrToast(
                "/api/portfolio/item",
                {
                    method: item ? "PATCH" : "POST",
                    body: JSON.stringify(
                        item
                            ? { itemId: item.id, ...draft }
                            : { showcaseId, ...draft },
                    ),
                },
                "Could not save that item.",
            );
            if (!response) return;
            toast.success(item ? "Item updated." : "Item added.");
            if (!item) setDraft(EMPTY_ITEM);
            onDone?.();
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3 rounded-box border border-hairline bg-surface p-4">
            <div className="grid gap-2 sm:grid-cols-2">
                <input
                    aria-label="Item title"
                    className="input input-bordered input-sm rounded-field sm:col-span-2"
                    placeholder="Title"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
                <input
                    aria-label="Item summary"
                    className="input input-bordered input-sm rounded-field sm:col-span-2"
                    placeholder="One-line summary"
                    value={draft.summary ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, summary: event.target.value || null })
                    }
                />
                <textarea
                    aria-label="Item description"
                    className="textarea textarea-bordered rounded-field sm:col-span-2"
                    placeholder="Case study (markdown)"
                    value={draft.description ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value || null })
                    }
                />
                <input
                    aria-label="Item link"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="https://…"
                    value={draft.link ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, link: event.target.value || null })
                    }
                />
                <input
                    aria-label="Item tags"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Tags, comma separated"
                    value={draft.tags.join(", ")}
                    onChange={(event) =>
                        setDraft({
                            ...draft,
                            tags: event.target.value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                        })
                    }
                />
                <input
                    aria-label="Item date"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="2024 or 2024-03"
                    value={draft.date ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, date: event.target.value || null })
                    }
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <label className="label cursor-pointer">
                    <span className="label-text mr-2">Cover image</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Add cover image"
                        disabled={busy}
                        onChange={(event) => addToGallery(event.target.files?.[0], "coverImage")}
                        className="file-input file-input-bordered file-input-xs rounded-field"
                    />
                </label>
                <label className="label cursor-pointer">
                    <span className="label-text mr-2">
                        Gallery ({draft.gallery.length} of {MAX_GALLERY_IMAGES})
                    </span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Add gallery image"
                        disabled={busy || atGalleryCap}
                        onChange={(event) => addToGallery(event.target.files?.[0], "gallery")}
                        className="file-input file-input-bordered file-input-xs rounded-field"
                    />
                </label>
            </div>

            {draft.gallery.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                    {draft.gallery.map((src) => (
                        <li key={src} className="relative">
                            <Image
                                src={src}
                                alt=""
                                width={80}
                                height={80}
                                className="h-20 w-20 rounded-field object-cover"
                            />
                            <button
                                type="button"
                                aria-label="Remove gallery image"
                                className="btn btn-xs btn-circle absolute -right-1 -top-1"
                                onClick={() =>
                                    setDraft((current) => ({
                                        ...current,
                                        gallery: current.gallery.filter((entry) => entry !== src),
                                    }))
                                }
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-field press"
                    disabled={busy || !draft.title}
                    onClick={save}
                >
                    {item ? "Save item" : "Add item"}
                </button>
                {onDone && (
                    <button type="button" className="btn btn-ghost btn-sm rounded-field" onClick={onDone}>
                        Done
                    </button>
                )}
            </div>
        </div>
    );
}
