"use client";

import { VARIANT_DIAGRAMS, type VariantDiagram } from "@/modules/profile-customization/visuals";
import { type ProfileLayoutVariant } from "@/modules/profile-customization/types";

export default function VariantPicker({
    value,
    onChange,
}: {
    value: ProfileLayoutVariant;
    onChange: (_next: ProfileLayoutVariant) => void;
}) {
    return (
        <div
            role="radiogroup"
            aria-label="Layout variant"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
            {VARIANT_DIAGRAMS.map((variant) => (
                <VariantCard
                    key={variant.variant}
                    variant={variant}
                    selected={variant.variant === value}
                    onSelect={() => onChange(variant.variant)}
                />
            ))}
        </div>
    );
}

function VariantCard({
    variant,
    selected,
    onSelect,
}: {
    variant: VariantDiagram;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={`group relative text-left rounded-box border-2 transition-all duration-150 p-3 bg-base-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:-translate-y-0.5 ${
                selected
                    ? "border-primary elev-2 ring-1 ring-primary/30"
                    : "border-hairline hover:border-hairline-strong"
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

            <VariantDiagram variant={variant.variant} />

            <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="font-semibold text-sm text-base-content">
                    {variant.label}
                </span>
                <span className="text-xs opacity-70 truncate">{variant.blurb}</span>
            </div>
        </button>
    );
}

function VariantDiagram({
    variant,
}: {
    variant: ProfileLayoutVariant;
}) {
    const common = "rounded-sm";
    const heroCls = `${common} bg-primary/40`;
    const sidebarCls = `${common} bg-primary/30`;
    const postCls = `${common} bg-primary/20`;

    if (variant === "standard") {
        return (
            <svg
                viewBox="0 0 120 60"
                className="w-full h-16"
                aria-hidden="true"
            >
                {/* hero spans full width */}
                <rect x="4" y="4" width="112" height="14" className={heroCls} />
                {/* sidebar (left) + posts (right) below */}
                <rect x="4" y="22" width="28" height="34" className={sidebarCls} />
                <rect x="36" y="22" width="80" height="10" className={postCls} />
                <rect x="36" y="36" width="80" height="10" className={postCls} />
                <rect x="36" y="50" width="80" height="6" className={postCls} />
            </svg>
        );
    }

    if (variant === "sidebar") {
        return (
            <svg
                viewBox="0 0 120 60"
                className="w-full h-16"
                aria-hidden="true"
            >
                {/* hero full width */}
                <rect x="4" y="4" width="112" height="14" className={heroCls} />
                {/* sticky sidebar column */}
                <rect x="4" y="22" width="36" height="34" className={sidebarCls} />
                {/* single tall posts column */}
                <rect x="44" y="22" width="72" height="34" className={postCls} />
            </svg>
        );
    }

    // wide
    return (
        <svg
            viewBox="0 0 120 60"
            className="w-full h-16"
            aria-hidden="true"
        >
            {/* hero full width */}
            <rect x="4" y="4" width="112" height="14" className={heroCls} />
            {/* posts span full width (no sidebar) */}
            <rect x="4" y="22" width="112" height="10" className={postCls} />
            <rect x="4" y="36" width="112" height="10" className={postCls} />
            <rect x="4" y="50" width="112" height="6" className={postCls} />
        </svg>
    );
}