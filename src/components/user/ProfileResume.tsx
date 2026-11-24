import type { ExperienceInput } from "@/modules/portfolio/types";

function formatDateRange(entry: ExperienceInput): string {
    const start = entry.startDate ?? "";
    if (entry.isCurrent) return [start, "Present"].filter(Boolean).join(" - ");
    const end = entry.endDate ?? "";
    const range = [start, end].filter(Boolean);
    return range.length > 0 ? range.join(" - ") : "";
}

function EntryList({
    title,
    entries,
}: {
    title: string;
    entries: ExperienceInput[];
}) {
    if (entries.length === 0) return null;
    return (
        <div>
            <h3 className="brand-rule mb-4 text-headline text-base-content">
                {title}
            </h3>
            <ol className="space-y-4">
                {entries.map((entry, index) => {
                    // The rows are read-only text here, so the index is a
                    // stable key. A key built from the fields would remount
                    // the row on every reorder.
                    const range = formatDateRange(entry);
                    const meta = [range, entry.location]
                        .filter(Boolean)
                        .join(" · ");
                    return (
                        <li key={index}>
                            <p className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-semibold text-base-content">
                                    {entry.role}
                                </span>
                                <span className="text-base-content/80">
                                    {entry.org}
                                </span>
                            </p>
                            {meta && (
                                <p className="text-xs opacity-70 nums">
                                    {meta}
                                </p>
                            )}
                            {entry.description && (
                                <p className="mt-1 text-sm whitespace-pre-line">
                                    {entry.description}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

/**
 * The Resume tab: the skills, the work and education timeline, and the
 * resume file. A profile with none of the three renders nothing.
 */
export default function ProfileResume({
    skills,
    experience,
    downloadUrl,
}: {
    skills: string[];
    experience: ExperienceInput[];
    downloadUrl: string | null;
}) {
    const work = experience.filter((entry) => entry.kind === "work");
    const education = experience.filter((entry) => entry.kind === "education");

    if (skills.length === 0 && experience.length === 0 && !downloadUrl) {
        return null;
    }

    return (
        <div className="space-y-6">
            {skills.length > 0 && (
                <div>
                    <h3 className="brand-rule mb-4 text-headline text-base-content">
                        Skills
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                        {skills.map((skill) => (
                            <li
                                key={skill}
                                className="badge badge-soft badge-sm"
                            >
                                {skill}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <EntryList title="Work" entries={work} />
            <EntryList title="Education" entries={education} />
            {downloadUrl && (
                <a
                    href={downloadUrl}
                    className="btn btn-primary btn-sm rounded-field press"
                >
                    Download resume
                </a>
            )}
        </div>
    );
}
