"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import {
    BACKGROUND_POSITIONS,
    BACKGROUND_SIZES,
    BORDER_STYLES,
    CARD_RADIUS,
    CARD_SHADOWS,
    FONT_FAMILIES,
    HEADING_SIZES,
    PROFILE_LAYOUT_VARIANTS,
    PROFILE_PRESETS,
    SPACING_DENSITIES,
    TEXT_ALIGNS,
    type ProfileCustomization,
    type ProfileSection,
} from "@/modules/profile-customization/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type ColorField =
    | "backgroundColor"
    | "textColor";

const COLOR_FALLBACK = "#ffffff";
const SAVE_DEBOUNCE_MS = 800;

const SECTION_LABELS: Record<ProfileSection, string> = {
    hero: "Hero",
    stats: "Stats",
    about: "About",
    socials: "Social Links",
    featuredPost: "Featured Post",
    interests: "Interests",
    organizations: "Organizations",
    posts: "Posts",
};

const COLOR_FIELDS: Array<{ field: ColorField; label: string }> = [
    { field: "backgroundColor", label: "Background color" },
    { field: "textColor", label: "Text color" },
];

function SelectField<T extends string>({
    id,
    label,
    value,
    options,
    onChange,
}: {
    id: string;
    label: string;
    value: T;
    options: readonly T[];
    onChange: (_selected: T) => void;
}) {
    return (
        <div className="form-control">
            <label htmlFor={id} className="label">
                {label}
            </label>
            <select
                id={id}
                className="select select-bordered"
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function ProfileCustomizationComponent({
    initialCustomization,
}: {
    initialCustomization: ProfileCustomization;
}) {
    const [customization, setCustomization] = useState<ProfileCustomization>(
        initialCustomization,
    );
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const snapshot = customization;
        const timer = setTimeout(async () => {
            setSaveStatus("saving");
            try {
                const res = await fetch("/api/user/profile-customization", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(snapshot),
                });
                setSaveStatus(res.ok ? "saved" : "error");
                if (!res.ok) toast.error("Failed to save customization");
            } catch {
                setSaveStatus("error");
                toast.error("Failed to save customization");
            }
        }, SAVE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [customization]);

    function setPreset(value: ProfileCustomization["preset"]) {
        setCustomization((c) => ({ ...c, preset: value }));
    }
    function setLayoutVariant(value: ProfileCustomization["layout"]["variant"]) {
        setCustomization((c) => ({ ...c, layout: { ...c.layout, variant: value } }));
    }
    function setColor(field: ColorField, value: string | null) {
        setCustomization((c) => ({ ...c, [field]: value }));
    }
    function setSimple<K extends keyof ProfileCustomization>(
        field: K,
        value: ProfileCustomization[K],
    ) {
        setCustomization((c) => ({ ...c, [field]: value }));
    }
    function toggleSectionHidden(section: ProfileSection) {
        setCustomization((c) => {
            const hidden = c.layout.hiddenSections.includes(section);
            const next = hidden
                ? c.layout.hiddenSections.filter((s) => s !== section)
                : [...c.layout.hiddenSections, section];
            return { ...c, layout: { ...c.layout, hiddenSections: next } };
        });
    }
    function moveSection(index: number, direction: -1 | 1) {
        setCustomization((c) => {
            const order = c.layout.sectionOrder;
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= order.length) return c;
            const next = [...order];
            [next[index], next[newIndex]] = [next[newIndex], next[index]];
            return { ...c, layout: { ...c.layout, sectionOrder: next } };
        });
    }
    function handleBackgroundFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);
        setUploading(true);
        (async () => {
            try {
                const formData = new FormData();
                formData.append("imgFile", file);
                const res = await fetch("/api/user/cloudinary/background", {
                    method: "POST",
                    body: formData,
                });
                if (!res.ok) throw new Error("upload failed");
                const { url } = (await res.json()) as { url: string };
                setCustomization((c) => ({ ...c, backgroundImage: url }));
                setPreviewUrl((p) => {
                    if (p) URL.revokeObjectURL(p);
                    return null;
                });
                toast.success("Background uploaded");
            } catch {
                setPreviewUrl((p) => {
                    if (p) URL.revokeObjectURL(p);
                    return null;
                });
                toast.error("Background upload failed");
            } finally {
                setUploading(false);
                event.target.value = "";
            }
        })();
    }
    function removeBackground() {
        setCustomization((c) => ({ ...c, backgroundImage: null }));
    }
    async function handleReset() {
        if (!window.confirm("Reset all profile customization to defaults?")) return;
        try {
            const res = await fetch("/api/user/profile-customization", { method: "DELETE" });
            if (!res.ok) throw new Error("reset failed");
            const data = (await res.json()) as ProfileCustomization;
            setCustomization(data);
            setSaveStatus("saved");
            toast.success("Customization reset to defaults");
        } catch {
            toast.error("Reset failed");
        }
    }
    const backgroundPreview = previewUrl ?? customization.backgroundImage ?? null;

    return (
        <div className="mx-auto lg:w-9/12 justify-center space-y-6">
            <div className="shadow-lg p-12 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold">Profile Customization</h3>
                    <span aria-live="polite" className="text-sm opacity-70">
                        {saveStatus === "idle" && "Ready"}
                        {saveStatus === "saving" && "Saving..."}
                        {saveStatus === "saved" && "Saved"}
                        {saveStatus === "error" && "Save failed"}
                    </span>
                </div>
                <SelectField
                    id="preset"
                    label="Preset"
                    value={customization.preset}
                    options={PROFILE_PRESETS}
                    onChange={setPreset}
                />
                <SelectField
                    id="variant"
                    label="Layout variant"
                    value={customization.layout.variant}
                    options={PROFILE_LAYOUT_VARIANTS}
                    onChange={setLayoutVariant}
                />
            </div>

            <div className="shadow-lg p-12 rounded-md space-y-2">
                <h3 className="text-2xl font-bold">Sections</h3>
                <ul className="space-y-2">
                    {customization.layout.sectionOrder.map((section, index) => {
                        const isHidden = customization.layout.hiddenSections.includes(section);
                        const atTop = index === 0;
                        const atBottom = index === customization.layout.sectionOrder.length - 1;
                        return (
                            <li key={section} className="flex items-center gap-2">
                                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="checkbox"
                                        checked={!isHidden}
                                        onChange={() => toggleSectionHidden(section)}
                                        aria-label={`Show ${SECTION_LABELS[section]}`}
                                    />
                                    <span>{SECTION_LABELS[section]}</span>
                                </label>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => moveSection(index, -1)}
                                    disabled={atTop}
                                    aria-label={`Move ${SECTION_LABELS[section]} up`}
                                    aria-disabled={atTop}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => moveSection(index, 1)}
                                    disabled={atBottom}
                                    aria-label={`Move ${SECTION_LABELS[section]} down`}
                                    aria-disabled={atBottom}
                                >
                                    ↓
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="shadow-lg p-12 rounded-md space-y-2">
                <h3 className="text-2xl font-bold">Colors</h3>
                {COLOR_FIELDS.map(({ field, label }) => (
                    <div key={field} className="flex items-center gap-3">
                        <input
                            type="color"
                            className="w-12 h-10 rounded border"
                            aria-label={label}
                            value={customization[field] ?? COLOR_FALLBACK}
                            onChange={(e) => setColor(field, e.target.value)}
                        />
                        <span className="flex-1">{label}</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setColor(field, null)}
                            aria-label={`Clear ${label}`}
                        >
                            Clear
                        </button>
                    </div>
                ))}
            </div>

            <div className="shadow-lg p-12 rounded-md space-y-2">
                <h3 className="text-2xl font-bold">Background Image</h3>
                {backgroundPreview && (
                    // eslint-disable-next-line @next/next/no-img-element -- preview may be a blob URL; next/image cannot optimize unknown hosts.
                    <img
                        src={backgroundPreview}
                        alt="Background preview"
                        className="w-full max-w-md h-40 object-cover rounded border"
                    />
                )}
                <div className="flex items-center gap-3">
                    <label className="btn btn-primary" htmlFor="backgroundFile">
                        {uploading ? "Uploading..." : "Choose background"}
                    </label>
                    <input
                        id="backgroundFile"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleBackgroundFile}
                        disabled={uploading}
                    />
                    {customization.backgroundImage && (
                        <button
                            type="button"
                            className="btn btn-warning"
                            onClick={removeBackground}
                            disabled={uploading}
                        >
                            Remove
                        </button>
                    )}
                </div>
                <SelectField
                    id="backgroundSize"
                    label="Background size"
                    value={customization.backgroundSize}
                    options={BACKGROUND_SIZES}
                    onChange={(v) => setSimple("backgroundSize", v)}
                />
                <SelectField
                    id="backgroundPosition"
                    label="Background position"
                    value={customization.backgroundPosition}
                    options={BACKGROUND_POSITIONS}
                    onChange={(v) => setSimple("backgroundPosition", v)}
                />
            </div>

            <div className="shadow-lg p-12 rounded-md space-y-2">
                <h3 className="text-2xl font-bold">Cards and Surfaces</h3>
                <SelectField
                    id="cardRadius"
                    label="Card radius"
                    value={customization.cardRadius}
                    options={CARD_RADIUS}
                    onChange={(v) => setSimple("cardRadius", v)}
                />
                <SelectField
                    id="cardShadow"
                    label="Card shadow"
                    value={customization.cardShadow}
                    options={CARD_SHADOWS}
                    onChange={(v) => setSimple("cardShadow", v)}
                />
                <SelectField
                    id="borderStyle"
                    label="Border style"
                    value={customization.borderStyle}
                    options={BORDER_STYLES}
                    onChange={(v) => setSimple("borderStyle", v)}
                />
            </div>

            <div className="shadow-lg p-12 rounded-md space-y-2">
                <h3 className="text-2xl font-bold">Typography</h3>
                <SelectField
                    id="fontFamily"
                    label="Font family"
                    value={customization.fontFamily}
                    options={FONT_FAMILIES}
                    onChange={(v) => setSimple("fontFamily", v)}
                />
                <SelectField
                    id="headingSize"
                    label="Heading size"
                    value={customization.headingSize}
                    options={HEADING_SIZES}
                    onChange={(v) => setSimple("headingSize", v)}
                />
                <SelectField
                    id="textAlign"
                    label="Text alignment"
                    value={customization.textAlign}
                    options={TEXT_ALIGNS}
                    onChange={(v) => setSimple("textAlign", v)}
                />
                <SelectField
                    id="spacingDensity"
                    label="Spacing density"
                    value={customization.spacingDensity}
                    options={SPACING_DENSITIES}
                    onChange={(v) => setSimple("spacingDensity", v)}
                />
            </div>

            <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-warning" onClick={handleReset}>
                    Reset to defaults
                </button>
            </div>
        </div>
    );
}
