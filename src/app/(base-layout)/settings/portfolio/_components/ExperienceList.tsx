"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import type { ExperienceInput } from "@/modules/portfolio/types";

export type ExperienceRow = ExperienceInput & { id: string; order: number };

const EMPTY_DRAFT: ExperienceInput = {
    kind: "work",
    org: "",
    role: "",
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
};

function dateRange(row: ExperienceRow): string {
    const start = row.startDate ?? "";
    if (row.isCurrent) return [start, "Present"].filter(Boolean).join(" - ");
    const end = row.endDate ?? "";
    return [start, end].filter(Boolean).join(" - ");
}

export default function ExperienceList({ initial }: { initial: ExperienceRow[] }) {
    const router = useRouter();
    const [rows, setRows] = useState(initial);
    const [draft, setDraft] = useState<ExperienceInput>(EMPTY_DRAFT);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    function startEditing(row: ExperienceRow) {
        setEditingId(row.id);
        setDraft({
            kind: row.kind,
            org: row.org,
            role: row.role,
            location: row.location,
            startDate: row.startDate,
            endDate: row.endDate,
            isCurrent: row.isCurrent,
            description: row.description,
        });
    }

    async function save() {
        setBusy(true);
        try {
            const response = await fetch("/api/portfolio/experience", {
                method: editingId ? "PATCH" : "POST",
                body: JSON.stringify(
                    editingId ? { experienceId: editingId, ...draft } : draft,
                ),
            });
            if (!response.ok) {
                toast.error("Could not save that entry");
                return;
            }
            // router.refresh() re-renders the page but keeps this component's
            // state, so the list has to be updated here or the owner sees the
            // old rows and adds the entry twice.
            if (editingId) {
                setRows((current) =>
                    current.map((row) =>
                        row.id === editingId ? { ...row, ...draft } : row,
                    ),
                );
            } else {
                const created = (await response.json()) as { id: string };
                setRows((current) => [
                    ...current,
                    { ...draft, id: created.id, order: current.length },
                ]);
            }
            toast.success(editingId ? "Entry updated." : "Entry added.");
            setDraft(EMPTY_DRAFT);
            setEditingId(null);
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    async function remove(id: string) {
        const response = await fetch("/api/portfolio/experience", {
            method: "DELETE",
            body: JSON.stringify({ experienceId: id }),
        });
        if (!response.ok) {
            // The row is still on the server, so it stays on screen.
            toast.error("Could not delete that entry.");
            return;
        }
        setRows((current) => current.filter((row) => row.id !== id));
        router.refresh();
    }

    async function move(id: string, direction: -1 | 1) {
        const response = await fetch("/api/portfolio/experience", {
            method: "PATCH",
            body: JSON.stringify({ experienceId: id, direction }),
        });
        if (!response.ok) return;

        setRows((current) => {
            const index = current.findIndex((row) => row.id === id);
            const neighbour = index + direction;
            if (index === -1 || neighbour < 0 || neighbour >= current.length) {
                return current;
            }
            const next = [...current];
            [next[index], next[neighbour]] = [next[neighbour], next[index]];
            return next;
        });
        router.refresh();
    }

    return (
        <section className="rounded-box border border-hairline bg-surface p-5 elev-1 sm:p-6 space-y-4">
            <h2 className="brand-rule text-headline text-base-content">Experience</h2>

            <ul className="space-y-3">
                {rows.map((row, index) => (
                    <li
                        key={row.id}
                        className="flex flex-wrap items-center gap-2 rounded-box bg-base-200/40 p-3"
                    >
                        <div className="flex-1">
                            <p className="font-semibold">
                                {`${row.role} · ${row.org}`}
                            </p>
                            <p className="text-xs opacity-70">
                                {dateRange(row)}
                                {row.location ? ` · ${row.location}` : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Edit ${row.org}`}
                            onClick={() => startEditing(row)}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${row.org} up`}
                            disabled={index === 0}
                            onClick={() => move(row.id, -1)}
                        >
                            Up
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field"
                            aria-label={`Move ${row.org} down`}
                            disabled={index === rows.length - 1}
                            onClick={() => move(row.id, 1)}
                        >
                            Down
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs rounded-field text-error"
                            aria-label={`Delete ${row.org}`}
                            onClick={() => remove(row.id)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>

            <div className="grid gap-2 border-t border-hairline pt-4 sm:grid-cols-2">
                <select
                    aria-label="Kind"
                    className="select select-bordered select-sm rounded-field"
                    value={draft.kind}
                    onChange={(event) =>
                        setDraft({ ...draft, kind: event.target.value as ExperienceInput["kind"] })
                    }
                >
                    <option value="work">Work</option>
                    <option value="education">Education</option>
                </select>
                <input
                    aria-label="Organisation"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Organisation"
                    value={draft.org}
                    onChange={(event) => setDraft({ ...draft, org: event.target.value })}
                />
                <input
                    aria-label="Role"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Role"
                    value={draft.role}
                    onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                />
                <input
                    aria-label="Location"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Location"
                    value={draft.location ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, location: event.target.value || null })
                    }
                />
                <input
                    aria-label="Start date"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="Start (YYYY-MM)"
                    value={draft.startDate ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, startDate: event.target.value || null })
                    }
                />
                <input
                    aria-label="End date"
                    className="input input-bordered input-sm rounded-field"
                    placeholder="End (YYYY-MM)"
                    disabled={draft.isCurrent}
                    value={draft.endDate ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, endDate: event.target.value || null })
                    }
                />
                <label className="label cursor-pointer justify-start gap-2">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={draft.isCurrent}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                isCurrent: event.target.checked,
                                endDate: event.target.checked ? null : draft.endDate,
                            })
                        }
                    />
                    <span className="label-text">Current role</span>
                </label>
                <textarea
                    aria-label="Description"
                    className="textarea textarea-bordered rounded-field sm:col-span-2"
                    placeholder="What you did (markdown)"
                    value={draft.description ?? ""}
                    onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value || null })
                    }
                />
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    className="btn btn-primary btn-sm rounded-field press"
                    onClick={save}
                    disabled={busy || !draft.org || !draft.role}
                >
                    {editingId ? "Save entry" : "Add entry"}
                </button>
                {editingId && (
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm rounded-field"
                        onClick={() => {
                            setEditingId(null);
                            setDraft(EMPTY_DRAFT);
                        }}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </section>
    );
}
