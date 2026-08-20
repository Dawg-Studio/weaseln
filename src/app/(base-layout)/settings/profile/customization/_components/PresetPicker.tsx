"use client";

import { PRESET_VISUALS, type PresetVisual } from "@/modules/profile-customization/visuals";
import { type ProfilePreset } from "@/modules/profile-customization/types";

export default function PresetPicker({
    value,
    onChange,
}: {
    value: ProfilePreset;
    onChange: (_next: ProfilePreset) => void;
}) {
    return (
        <div
            role="radiogroup"
            aria-label="Preset"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
            {PRESET_VISUALS.map((preset) => (
                <PresetCard
                    key={preset.preset}
                    preset={preset}
                    selected={preset.preset === value}
                    onSelect={() => onChange(preset.preset)}
                />
            ))}
        </div>
    );
}

function PresetCard({
    preset,
    selected,
    onSelect,
}: {
    preset: PresetVisual;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={`group relative text-left rounded-lg border-2 transition-all duration-150 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:-translate-y-0.5 ${
                selected
                    ? "border-primary shadow-md ring-1 ring-primary/30"
                    : "border-base-300 hover:border-base-content/30"
            }`}
        >
            {selected && (
                <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 badge badge-primary badge-sm"
                >
                    <svg
                        className="w-3 h-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.585l7.296-7.296a1 1 0 011.408 0z"
                            clipRule="evenodd"
                        />
                    </svg>
                </span>
            )}

            {/* Mini mockup */}
            <div
                aria-hidden="true"
                className="h-20 w-full flex items-center justify-center gap-1.5 p-3"
                style={{ backgroundColor: preset.swatches.page }}
            >
                <div
                    className="w-6 h-6 rounded-full shrink-0"
                    style={{ backgroundColor: preset.swatches.accent }}
                />
                <div className="flex-1 space-y-1">
                    <div
                        className="h-1.5 w-3/4 rounded"
                        style={{ backgroundColor: preset.swatches.text, opacity: 0.85 }}
                    />
                    <div
                        className="h-1 w-1/2 rounded"
                        style={{ backgroundColor: preset.swatches.text, opacity: 0.5 }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    {Array.from({ length: preset.blocks }).map((_, i) => (
                        <div
                            key={i}
                            className="h-1 w-6 rounded"
                            style={{ backgroundColor: preset.swatches.text, opacity: 0.25 + i * 0.1 }}
                        />
                    ))}
                </div>
            </div>

            {/* Labels */}
            <div className="px-3 py-2 bg-base-100 flex items-baseline justify-between gap-2">
                <span className="font-semibold text-sm text-base-content">
                    {preset.label}
                </span>
                <span className="text-xs opacity-70 truncate">{preset.blurb}</span>
            </div>
        </button>
    );
}