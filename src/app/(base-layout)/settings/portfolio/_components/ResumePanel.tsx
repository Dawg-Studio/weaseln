"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import type {
    ExperienceInput,
    ResumeLink,
    ResumeProposal,
} from "@/modules/portfolio/types";

type ProposalRow = ExperienceInput & { checked: boolean };

type Facts = {
    headline: string;
    summary: string;
    location: string;
    skills: string;
};

function splitSkills(value: string): string[] {
    return value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
}

/**
 * Upload → review → apply. Nothing reaches the profile until the owner presses
 * "Add": the response is a proposal, not a write.
 */
export default function ResumePanel({
    initialPublic,
    hasResume,
}: {
    initialPublic: boolean;
    hasResume: boolean;
}) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [isPublic, setIsPublic] = useState(initialPublic);
    const [stored, setStored] = useState(hasResume);
    const [rows, setRows] = useState<ProposalRow[]>([]);
    const [facts, setFacts] = useState<Facts | null>(null);
    const [links, setLinks] = useState<ResumeLink[]>([]);

    async function uploadResume() {
        if (!file) return;
        setBusy(true);
        try {
            const form = new FormData();
            form.append("resume", file);
            const response = await fetch("/api/portfolio/resume", {
                method: "POST",
                body: form,
            });
            const body = (await response.json()) as {
                url?: string;
                proposal?: ResumeProposal | null;
                error?: string | null;
            };
            if (body.url) setStored(true);

            if (body.proposal) {
                setRows(body.proposal.experience.map((row) => ({ ...row, checked: true })));
                setFacts({
                    headline: body.proposal.headline ?? "",
                    summary: body.proposal.summary ?? "",
                    location: body.proposal.location ?? "",
                    skills: body.proposal.skills.join(", "),
                });
                setLinks(body.proposal.links);
                toast.success("Resume stored. Review what was found.");
            } else {
                toast.error(body.error ?? "Could not read this resume");
            }
        } catch {
            toast.error("Upload failed");
        } finally {
            setBusy(false);
            router.refresh();
        }
    }

    function toggleRow(index: number) {
        setRows((current) =>
            current.map((row, position) =>
                position === index ? { ...row, checked: !row.checked } : row,
            ),
        );
    }

    function editRow(index: number, patch: Partial<ExperienceInput>) {
        setRows((current) =>
            current.map((row, position) =>
                position === index ? { ...row, ...patch } : row,
            ),
        );
    }

    async function applyProposal() {
        const chosen = rows
            .filter((row) => row.checked)
            .map(({ checked: _checked, ...row }) => row);

        const payload = {
            headline: facts?.headline || null,
            summary: facts?.summary || null,
            location: facts?.location || null,
            links,
            skills: splitSkills(facts?.skills ?? ""),
            experience: chosen,
        };

        setBusy(true);
        try {
            const response = await fetch("/api/portfolio/resume/apply", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                toast.error("Could not add those entries");
                return;
            }
            toast.success("Experience added to your profile.");
            setRows([]);
            setFacts(null);
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    async function setVisibility(next: boolean) {
        setIsPublic(next);
        await fetch("/api/portfolio/resume", {
            method: "PATCH",
            body: JSON.stringify({ isPublic: next }),
        });
        router.refresh();
    }

    async function remove() {
        if (!window.confirm("Remove your resume? The stored file is deleted.")) {
            return;
        }
        await fetch("/api/portfolio/resume", { method: "DELETE" });
        setStored(false);
        setIsPublic(false);
        setRows([]);
        setFacts(null);
        toast.success("Resume removed.");
        router.refresh();
    }

    const checkedCount = rows.filter((row) => row.checked).length;

    return (
        <section className="rounded-box border border-hairline bg-surface p-5 elev-1 sm:p-6 space-y-4">
            <h2 className="brand-rule text-headline text-base-content">Resume</h2>
            <p className="text-sm opacity-70">
                Your PDF is sent to Google&apos;s Gemini API to read your
                experience, and stored at Cloudinary. It stays private unless
                you publish it below.
            </p>

            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="file"
                    accept="application/pdf"
                    aria-label="Resume PDF"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="file-input file-input-bordered file-input-sm rounded-field"
                />
                <button
                    type="button"
                    onClick={uploadResume}
                    disabled={!file || busy}
                    className="btn btn-primary btn-sm rounded-field press"
                >
                    {busy ? "Reading..." : "Upload and read"}
                </button>
            </div>

            {stored && (
                <div className="flex flex-wrap items-center gap-4">
                    <label className="label cursor-pointer gap-2">
                        <input
                            type="checkbox"
                            className="toggle toggle-sm"
                            checked={isPublic}
                            onChange={(event) => setVisibility(event.target.checked)}
                        />
                        <span className="label-text">
                            Show a download link on my profile
                        </span>
                    </label>
                    <button
                        type="button"
                        onClick={remove}
                        className="btn btn-ghost btn-sm rounded-field text-error press"
                    >
                        Remove resume
                    </button>
                </div>
            )}

            {facts && (
                <div className="space-y-4 border-t border-hairline pt-4">
                    <p className="text-sm font-semibold">
                        Found {rows.length} {rows.length === 1 ? "entry" : "entries"} — keep what is right.
                    </p>

                    <ul className="space-y-3">
                        {rows.map((row, index) => (
                            <li
                                key={`${row.org}-${row.role}-${index}`}
                                className="space-y-2 rounded-box bg-base-200/40 p-3"
                            >
                                <label className="label cursor-pointer justify-start gap-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={row.checked}
                                        aria-label={`${row.org} ${row.role}`}
                                        onChange={() => toggleRow(index)}
                                    />
                                    <span className="label-text">
                                        {row.role} · {row.org}
                                    </span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        aria-label={`Organisation ${index + 1}`}
                                        value={row.org}
                                        onChange={(event) => editRow(index, { org: event.target.value })}
                                        className="input input-bordered input-sm rounded-field"
                                    />
                                    <input
                                        aria-label={`Role ${index + 1}`}
                                        value={row.role}
                                        onChange={(event) => editRow(index, { role: event.target.value })}
                                        className="input input-bordered input-sm rounded-field"
                                    />
                                    <input
                                        aria-label={`Start ${index + 1}`}
                                        value={row.startDate ?? ""}
                                        placeholder="YYYY-MM"
                                        onChange={(event) => editRow(index, { startDate: event.target.value || null })}
                                        className="input input-bordered input-sm w-28 rounded-field"
                                    />
                                    <input
                                        aria-label={`End ${index + 1}`}
                                        value={row.endDate ?? ""}
                                        placeholder={row.isCurrent ? "Present" : "YYYY-MM"}
                                        disabled={row.isCurrent}
                                        onChange={(event) => editRow(index, { endDate: event.target.value || null })}
                                        className="input input-bordered input-sm w-28 rounded-field"
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            aria-label="Headline"
                            placeholder="Headline (occupation)"
                            value={facts.headline}
                            onChange={(event) => setFacts({ ...facts, headline: event.target.value })}
                            className="input input-bordered input-sm rounded-field"
                        />
                        <input
                            aria-label="Location"
                            placeholder="Location (address)"
                            value={facts.location}
                            onChange={(event) => setFacts({ ...facts, location: event.target.value })}
                            className="input input-bordered input-sm rounded-field"
                        />
                        <input
                            aria-label="Skills"
                            placeholder="Skills, comma separated"
                            value={facts.skills}
                            onChange={(event) => setFacts({ ...facts, skills: event.target.value })}
                            className="input input-bordered input-sm rounded-field sm:col-span-2"
                        />
                        <textarea
                            aria-label="Summary"
                            placeholder="Summary (bio)"
                            value={facts.summary}
                            onChange={(event) => setFacts({ ...facts, summary: event.target.value })}
                            className="textarea textarea-bordered rounded-field sm:col-span-2"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={applyProposal}
                        disabled={busy}
                        className="btn btn-primary btn-sm rounded-field press"
                    >
                        Add {checkedCount} {checkedCount === 1 ? "entry" : "entries"}
                    </button>
                </div>
            )}
        </section>
    );
}
