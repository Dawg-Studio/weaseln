"use client";

import NextImage from "next/image";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import Modal from "@/components/ui/Modal";
import { postSurfaceProps } from "@/modules/post-customization/surface";
import {
    POST_IMAGE_FITS,
    type PostCustomization,
    type PostImageFit,
} from "@/modules/post-customization/types";
import { isDefaultPostCustomization } from "@/modules/post-customization/validation";
import {
    BACKGROUND_SWATCHES,
    BUNDLED_BACKGROUND_IMAGES,
    PATTERN_OPTIONS,
} from "@/modules/post-customization/visuals";
import { cn } from "@/utils/cn";

/**
 * The composer's background picker (issue #21, criteria 1, 2 and 6).
 *
 * Lives behind ONE button in the Tiptap action bar rather than as an inline
 * swatch strip: that bar is `flex items-center overflow-auto gap-3` and already
 * carries four controls, so a fifth strip would fold onto a second row at
 * 360px. Inside the dialog the groups are free to wrap.
 *
 * Every option is a `role="radio"` inside a named `role="radiogroup"`, and each
 * group is ONE tab stop with arrow keys moving the selection — the roving
 * tabindex the WAI-ARIA radio group pattern asks for. `PresetPicker.tsx` (the
 * profile analogue) makes every option its own tab stop and ignores arrow keys;
 * that defect is not copied here.
 */

/** The shape the roving group needs from any option it renders. */
type RadioLike = { value: string; label: string };

/**
 * The image group's options. "Remove image" is an option rather than a button
 * beside the group, so clearing the image is reachable by the same arrow sweep
 * as choosing one and the group always has exactly one checked radio.
 */
type ImageOption = RadioLike & { url: string | null };

const IMAGE_OPTIONS: ImageOption[] = [
    { value: "", label: "Remove image", url: null },
    ...BUNDLED_BACKGROUND_IMAGES.map((image) => ({
        value: image.url,
        label: image.label,
        url: image.url,
    })),
];

/** Derived from the module's union, so a new fit cannot be forgotten here. */
const FIT_LABELS: Record<PostImageFit, string> = {
    cover: "Fill",
    tile: "Tile",
};

const FIT_OPTIONS: RadioLike[] = POST_IMAGE_FITS.map((fit) => ({
    value: fit,
    label: FIT_LABELS[fit],
}));

export default function PostBackgroundPicker({
    value,
    onChange,
}: {
    value: PostCustomization;
    onChange: (_next: PostCustomization) => void;
}) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const groupId = useId();
    const customized = !isDefaultPostCustomization(value);
    const selectedSwatch = BACKGROUND_SWATCHES.find(
        (swatch) => swatch.value === value.backgroundColor,
    );

    return (
        <>
            <button
                type="button"
                className={cn(
                    "btn h-11 min-h-11 shrink-0 gap-2 rounded-field px-5 text-sm font-semibold press",
                    customized
                        ? "border-primary bg-tint text-base-content hover:border-primary hover:bg-tint-strong"
                        : "btn-outline border-hairline-strong bg-transparent text-base-content hover:border-primary hover:bg-tint hover:text-base-content",
                )}
                // `showModal()` rather than ImageUploadForm's `show()`. Two
                // reasons: only the modal form traps focus and closes on
                // Escape, which a keyboard widget needs; and the composer bar
                // this button sits in carries `glass-nav`, whose
                // `backdrop-filter` makes it the containing block for any
                // fixed-position descendant — a non-modal dialog would be
                // positioned against the bar and clipped by its `overflow`.
                // The top layer a modal dialog enters is measured against the
                // viewport instead.
                onClick={() => modalRef.current?.showModal()}
            >
                <span
                    aria-hidden="true"
                    className="size-4 rounded-full border border-hairline-strong"
                    style={{
                        background:
                            selectedSwatch?.token ?? "var(--color-surface)",
                    }}
                />
                Background
            </button>
            <Modal
                className="w-full max-w-lg space-y-6 overflow-auto"
                ref={modalRef}
            >
                <div className="space-y-1">
                    <h3 className="text-headline text-base-content">
                        Post background
                    </h3>
                    <p className="text-meta text-muted">
                        Applies to this post everywhere it appears — the feed
                        card and the post page read the same choice.
                    </p>
                </div>

                {/* The live sample is painted by postSurfaceProps(), the same
                    helper the card and the detail page spread, so it cannot
                    promise an appearance that publishing would not produce. */}
                <div
                    aria-hidden="true"
                    {...postSurfaceProps(value)}
                    className="space-y-2 rounded-box border border-hairline bg-surface p-4"
                >
                    <p className="text-subhead text-base-content">Your title</p>
                    <span className="block h-2 w-full rounded-full bg-base-content/15" />
                    <span className="block h-2 w-4/5 rounded-full bg-base-content/15" />
                    <span className="block h-2 w-2/3 rounded-full bg-base-content/15" />
                </div>

                <RovingRadioGroup
                    labelId={`${groupId}-color`}
                    heading="Background colour"
                    options={BACKGROUND_SWATCHES}
                    selected={value.backgroundColor}
                    onSelect={(swatch) =>
                        onChange({ ...value, backgroundColor: swatch.value })
                    }
                    optionClassName="size-10 rounded-full p-0.5"
                    renderOption={(swatch, isSelected) => (
                        <>
                            {/* Painted from the token the post surface itself
                                reads, so the swatch is theme-correct by
                                construction — no hex to drift in dark mode. */}
                            <span
                                aria-hidden="true"
                                className="block size-full rounded-full"
                                style={{ background: swatch.token }}
                            />
                            {isSelected && <SelectedMark />}
                        </>
                    )}
                />

                <RovingRadioGroup
                    labelId={`${groupId}-pattern`}
                    heading="Texture"
                    hint={
                        value.backgroundImage
                            ? "Hidden while a background image is set."
                            : undefined
                    }
                    options={PATTERN_OPTIONS}
                    selected={value.backgroundPattern}
                    onSelect={(pattern) =>
                        onChange({ ...value, backgroundPattern: pattern.value })
                    }
                    optionClassName="gap-2 px-2 py-1.5"
                    renderOption={(pattern) => (
                        <>
                            <span
                                aria-hidden="true"
                                {...postSurfaceProps({
                                    backgroundColor: value.backgroundColor,
                                    backgroundPattern: pattern.value,
                                })}
                                className="size-7 rounded-field border border-hairline bg-base-200"
                            />
                            <span className="text-sm text-base-content">
                                {pattern.label}
                            </span>
                        </>
                    )}
                />

                <RovingRadioGroup
                    labelId={`${groupId}-image`}
                    heading="Background image"
                    hint="A background image covers the texture."
                    options={IMAGE_OPTIONS}
                    selected={value.backgroundImage ?? ""}
                    onSelect={(image) =>
                        onChange({ ...value, backgroundImage: image.url })
                    }
                    optionClassName="flex-col gap-1 p-1.5"
                    renderOption={(image) => (
                        <>
                            {image.url ? (
                                <NextImage
                                    aria-hidden="true"
                                    src={image.url}
                                    alt=""
                                    width={96}
                                    height={64}
                                    className="h-12 w-20 rounded-field object-cover"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="grid h-12 w-20 place-items-center rounded-field border border-dashed border-hairline-strong text-meta text-muted"
                                >
                                    None
                                </span>
                            )}
                            <span className="text-meta text-base-content">
                                {image.label}
                            </span>
                        </>
                    )}
                />

                {value.backgroundImage && (
                    <RovingRadioGroup
                        labelId={`${groupId}-fit`}
                        heading="Image fit"
                        options={FIT_OPTIONS}
                        selected={value.backgroundFit}
                        onSelect={(fit) =>
                            onChange({
                                ...value,
                                // The list is built from POST_IMAGE_FITS, so
                                // this value really is one of them.
                                backgroundFit: fit.value as PostImageFit,
                            })
                        }
                        optionClassName="px-3 py-1.5 text-sm text-base-content"
                        renderOption={(fit) => fit.label}
                    />
                )}

                <div className="modal-action">
                    <form method="dialog">
                        <button className="btn h-11 min-h-11 rounded-field px-5 text-sm font-semibold press">
                            Done
                        </button>
                    </form>
                </div>
            </Modal>
        </>
    );
}

/**
 * One WAI-ARIA radio group with a roving tabindex.
 *
 * The checked option is the group's only tab stop; arrow keys (and Home/End)
 * move focus AND the selection, wrapping at both ends, which is the behaviour
 * the pattern specifies for a group where every option is a legal choice. Each
 * option carries an `aria-label`, because a colour circle or a thumbnail names
 * nothing on its own.
 */
function RovingRadioGroup<Option extends RadioLike>({
    labelId,
    heading,
    hint,
    options,
    selected,
    onSelect,
    optionClassName,
    renderOption,
}: {
    labelId: string;
    heading: string;
    hint?: string;
    options: readonly Option[];
    selected: string;
    onSelect: (_option: Option) => void;
    optionClassName?: string;
    renderOption: (_option: Option, _isSelected: boolean) => ReactNode;
}) {
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    // A stored value the picker does not offer — an author's Cloudinary URL,
    // say — checks nothing; the first option then holds the tab stop so the
    // group stays reachable.
    const foundIndex = options.findIndex((option) => option.value === selected);
    const activeIndex = foundIndex === -1 ? 0 : foundIndex;

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) {
        const count = options.length;
        let next: number;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowDown":
                next = (index + 1) % count;
                break;
            case "ArrowLeft":
            case "ArrowUp":
                next = (index - 1 + count) % count;
                break;
            case "Home":
                next = 0;
                break;
            case "End":
                next = count - 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        onSelect(options[next]);
        optionRefs.current[next]?.focus();
    }

    return (
        <div className="space-y-2">
            <div>
                <h4
                    id={labelId}
                    className="text-sm font-semibold text-base-content"
                >
                    {heading}
                </h4>
                {hint && <p className="text-meta text-muted">{hint}</p>}
            </div>
            {/* `flex-wrap`, not a scroller: at 360px the ten swatches fold to a
                second row instead of hiding half of themselves off-screen. */}
            <div
                role="radiogroup"
                aria-labelledby={labelId}
                className="flex flex-wrap gap-2"
            >
                {options.map((option, index) => {
                    const isSelected = option.value === selected;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={option.label}
                            tabIndex={index === activeIndex ? 0 : -1}
                            ref={(node) => {
                                optionRefs.current[index] = node;
                            }}
                            onClick={() => onSelect(option)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={cn(
                                "relative flex items-center justify-center rounded-field border bg-transparent transition-colors duration-150 press focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                isSelected
                                    ? "border-primary ring-1 ring-primary/30"
                                    : "border-hairline hover:border-hairline-strong",
                                optionClassName,
                            )}
                        >
                            {renderOption(option, isSelected)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * The check on the chosen swatch, drawn in body ink so it reads on every tint
 * in both themes.
 */
function SelectedMark() {
    return (
        <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center text-base-content"
        >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.585l7.296-7.296a1 1 0 011.408 0z"
                    clipRule="evenodd"
                />
            </svg>
        </span>
    );
}
