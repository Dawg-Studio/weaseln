"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import {
    SHOWCASE_LAYOUTS,
    type ShowcaseLayout,
} from "@/modules/portfolio/types";

export type ShowcaseListItem = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    layout: ShowcaseLayout;
    order: number;
};

export default function ShowcasesList({ initial }: { initial: ShowcaseListItem[] }) {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [layout, setLayout] = useState<ShowcaseLayout>("grid");
    const [busy, setBusy] = useState(false);

    async function create() {
        setBusy(true);
        try {
            const response = await fetch("/api/portfolio/showcase", {
                method: "POST",
                body: JSON.stringify({ title, description: null, layout }),
            });
            if (!response.ok) {
                toast.error("Could not create that showcase");
                return;
            }
            const created = (await response.json()) as { id: string };
            router.push(`/settings/portfolio/showcase/${created.id}`);
        } finally {
            setBusy(false);
        }
    }

    async function move(showcaseId: string, direction: -1 | 1) {
        await fetch("/api/portfolio/showcase", {
            method: "PATCH",
            body: JSON.stringify({ showcaseId, direction }),
        });
        router.refresh();
    }

    return (
        <div className="space-y-6">
            <ul className="space-y-2">
                {initial.map((showcase, index) => (
                    <li
                        key={showcase.id}
                        className="flex flex-wrap items-center gap-2 rounded-box border border-hairline bg-surface p-3"
                    >
                        <Link
                            href={`/settings/portfolio/showcase/${showcase.id}`}
                            className="flex-1 font-semibold link-hover"
                        >
                            {showcase.title}
                        </Link>
                        <span className="badge badge-soft badge-sm">{showcase.layout}</span>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${showcase.title} up`}
                            disabled={index === 0}
                            onClick={() => move(showcase.id, -1)}
                        >
                            Up
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${showcase.title} down`}
                            disabled={index === initial.length - 1}
                            onClick={() => move(showcase.id, 1)}
                        >
                            Down
                        </button>
                    </li>
                ))}
                {initial.length === 0 && (
                    <li className="text-sm opacity-70">
                        No showcases yet. Make one for each kind of work you do.
                    </li>
                )}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                <input
                    aria-label="New showcase title"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Photography, Shipped apps, 3D renders…"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
                <select
                    aria-label="New showcase layout"
                    className="select select-bordered select-sm rounded-field"
                    value={layout}
                    onChange={(event) => setLayout(event.target.value as ShowcaseLayout)}
                >
                    {SHOWCASE_LAYOUTS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-field press"
                    disabled={busy || !title.trim()}
                    onClick={create}
                >
                    New showcase
                </button>
            </div>
        </div>
    );
}
