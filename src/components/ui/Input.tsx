"use client";

import type { FormContext } from "@/types/formContext";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/utils/cn";
import { RegisterOptions, useFormContext } from "react-hook-form";

// Shared by the app's form controls and the auth form. Keep control-specific
// sizing, border widths, and validation states at each call site.
export const FIELD_SKIN =
    "w-full rounded-field border-hairline bg-surface text-base-content " +
    "transition-[border-color,box-shadow,background-color] duration-150 ease-burrow " +
    "placeholder:text-muted hover:border-hairline-strong focus:border-primary " +
    "disabled:pointer-events-none disabled:opacity-45";

export default function Input({
    name,
    type,
    placeholder,
    required,
    value,
    maxLength,
    onChange,
    disabled,
}: FormContext & RegisterOptions) {
    const {
        register,
        watch,
        formState: { errors },
    } = useFormContext();

    // `name` doubles as the react-hook-form field key and as the label target,
    // but it can carry spaces ("Personal Website") — illegal in an id, and it
    // would split an aria-describedby token list in two. Derive stable ids.
    const fieldId = `field-${name.replace(/\s+/g, "-")}`;
    const errorId = `${fieldId}-error`;
    const counterId = `${fieldId}-counter`;

    const hasError = Boolean(errors[name]);
    const hasCounter = type === "textarea" && Boolean(maxLength?.value);
    const describedBy =
        [hasError ? errorId : null, hasCounter ? counterId : null]
            .filter(Boolean)
            .join(" ") || undefined;

    // One field skin for every control type: a fresh sheet on the cream
    // canvas, a warm hairline at rest, rust on focus, error red when invalid.
    const fieldSkin = cn(
        FIELD_SKIN,
        !hasError && "focus:[--input-color:var(--color-primary)]",
    );

    return (
        <div className="form-control w-full">
            <label
                htmlFor={fieldId}
                className="label mb-1.5 flex items-center justify-start gap-1 px-0 py-0"
            >
                <span className="label-text text-sm font-medium text-base-content">
                    {name}{" "}
                    {required.value && (
                        <span aria-hidden="true" className="text-error">
                            *
                        </span>
                    )}
                </span>
            </label>
            {type !== "textarea" ? (
                <input
                    id={fieldId}
                    type={type}
                    placeholder={placeholder}
                    aria-required={Boolean(required.value)}
                    aria-invalid={hasError || undefined}
                    aria-describedby={describedBy}
                    {...register(name, {
                        value: value,
                        required: required,
                        onChange: onChange,
                        disabled: disabled,
                    })}
                    className={cn(
                        fieldSkin,
                        type === "file"
                            ? "file-input h-11"
                            : "input h-11",
                        hasError &&
                            (type === "file"
                                ? "file-input-error border-error"
                                : "input-error border-error"),
                    )}
                />
            ) : (
                <>
                    <textarea
                        id={fieldId}
                        className={cn(
                            "textarea min-h-32 py-3 leading-relaxed",
                            fieldSkin,
                            hasError && "textarea-error border-error",
                        )}
                        placeholder={placeholder}
                        aria-required={Boolean(required.value)}
                        aria-invalid={hasError || undefined}
                        aria-describedby={describedBy}
                        {...register(name, {
                            value: value,
                            maxLength: maxLength?.value,
                        })}
                        onKeyDown={(e) => {
                            if (
                                e.key !== "Backspace" &&
                                watch(name) !== undefined &&
                                maxLength?.value &&
                                watch(name)?.length >= maxLength?.value
                            )
                                e.preventDefault();
                        }}
                    />
                    <div
                        id={counterId}
                        className="mt-1.5 flex justify-end nums text-meta text-muted"
                    >
                        {watch(name) !== undefined &&
                            maxLength?.value &&
                            `${watch(name).length} / ${maxLength?.value}`}
                    </div>
                </>
            )}
            {hasError && (
                <div
                    id={errorId}
                    role="alert"
                    className="mt-1.5 flex items-start gap-1.5 text-meta font-medium text-error"
                >
                    <FontAwesomeIcon
                        icon={faCircleExclamation}
                        aria-hidden="true"
                        className="mt-px w-3.5 shrink-0"
                    />
                    <span>
                        {errors[name]?.type === "uniqueConstraint" &&
                            errors[name]?.message?.toString()}
                        {errors[name]?.type === "maxLength" &&
                            maxLength?.message}
                        {errors[name]?.type === "required" && required.message}
                    </span>
                </div>
            )}
        </div>
    );
}
