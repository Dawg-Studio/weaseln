"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import {
    SHOWCASE_LAYOUTS,
    type ItemInput,
    type ShowcaseLayout,
} from "@/modules/portfolio/types";
import ItemEditor from "./ItemEditor";

type ShowcaseEditable = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    layout: ShowcaseLayout;
};

type ItemRow = ItemInput & { id: string; slug: string };

export default function ShowcaseEditor({
    showcase,
    items,
    username,
}: {
    showcase: ShowcaseEditable;
    items: ItemRow[];
    userId: string;
    username: string;
}) {
    const router = useRouter();
    const [draft, setDraft] = useState(showcase);
    const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);

    async function saveShowcase() {
        setBusy(true);
        try {
            const response = await fetch("/api/portfolio/showcase", {
                method: "PATCH",
                body: JSON.stringify({
                    showcaseId: showcase.id,
                    title: draft.title,
                    description: draft.description,
                    layout: draft.layout,
                }),
            });
            if (!response.ok) {
                toast.error("Could not save this showcase");
                return;
            }
            toast.success("Showcase saved.");
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    async function deleteShowcase() {
        if (!window.confirm("Delete this showcase and its items?")) return;
        const response = await fetch("/api/portfolio/showcase", {
            method: "DELETE",
            body: JSON.stringify({ showcaseId: showcase.id }),
        });
        if (!response.ok) {
            toast.error("Could not delete this showcase.");
            return;
        }
        router.push("/settings/portfolio/showcases");
    }

    async function deleteItem(itemId: string) {
        const response = await fetch("/api/portfolio/item", {
            method: "DELETE",
            body: JSON.stringify({ itemId }),
        });
        if (!response.ok) {
            // The item is still on the server, so it stays in the list.
            toast.error("Could not delete that item.");
            return;
        }
        router.refresh();
    }

    async function moveItem(itemId: string, direction: -1 | 1) {
        await fetch("/api/portfolio/item", {
            method: "PATCH",
            body: JSON.stringify({ itemId, direction }),
        });
        router.refresh();
    }

    return (
        <div className="space-y-6">
            <div className="rounded-box border border-hairline bg-surface p-5 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                    <input
                        aria-label="Showcase title"
                        className="input input-bordered input-sm rounded-field"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                    <select
                        aria-label="Showcase layout"
                        className="select select-bordered select-sm rounded-field"
                        value={draft.layout}
                        onChange={(event) =>
                            setDraft({ ...draft, layout: event.target.value as ShowcaseLayout })
                        }
                    >
                        {SHOWCASE_LAYOUTS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <textarea
                        aria-label="Showcase description"
                        className="textarea textarea-bordered rounded-field sm:col-span-2"
                        placeholder="What this section is"
                        value={draft.description ?? ""}
                        onChange={(event) =>
                            setDraft({ ...draft, description: event.target.value || null })
                        }
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm rounded-field press"
                        onClick={saveShowcase}
                        disabled={busy || !draft.title.trim()}
                    >
                        Save showcase
                    </button>
                    <Link
                        href={`/${username}/portfolio/${showcase.slug}`}
                        className="btn btn-ghost btn-sm rounded-field"
                    >
                        View public page
                    </Link>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm rounded-field text-error"
                        onClick={deleteShowcase}
                    >
                        Delete showcase
                    </button>
                </div>
            </div>

            <ul className="space-y-2">
                {items.map((item, index) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 rounded-box border border-hairline bg-surface p-3"
                    >
                        {(item.coverImage ?? item.gallery[0]) && (
                            <Image
                                src={(item.coverImage ?? item.gallery[0]) as string}
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-field object-cover"
                            />
                        )}
                        <span className="flex-1 font-medium">{item.title}</span>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => setEditingItem(item)}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${item.title} up`}
                            disabled={index === 0}
                            onClick={() => moveItem(item.id, -1)}
                        >
                            Up
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${item.title} down`}
                            disabled={index === items.length - 1}
                            onClick={() => moveItem(item.id, 1)}
                        >
                            Down
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field text-error"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => deleteItem(item.id)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>

            {editingItem ? (
                <ItemEditor
                    showcaseId={showcase.id}
                    item={editingItem}
                    onDone={() => setEditingItem(null)}
                />
            ) : adding ? (
                <ItemEditor showcaseId={showcase.id} onDone={() => setAdding(false)} />
            ) : (
                <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-field press"
                    onClick={() => setAdding(true)}
                >
                    New item
                </button>
            )}
        </div>
    );
}
