"use client";

import { Fragment, useState } from "react";

export default function TagInput({
    value,
    onChange,
    validate,
    tagList,
    maxTags = 4,
}: {
    value: string[];
    onChange: (_tags: string[]) => void;
    validate?: (_tag: string) => Promise<boolean>;
    tagList?: string[];
    maxTags?: number;
}) {
    const [searchTag, setSearchTag] = useState<string>("");
    const [tagValidateResult, setTagValidateResult] = useState<boolean>();
    const [availableTags, setAvailableTags] = useState<string[]>(tagList ?? []);

    const filteredTags = (availableTags ?? [])
        .filter((tag) => tag.toLowerCase().includes(searchTag.toLowerCase()))
        .sort();

    const matches = filteredTags.length > 0;

    function addTag(tag: string) {
        if (value.length >= maxTags) return;
        onChange([...value, tag]);
        setAvailableTags([
            ...(availableTags ?? []).filter((tagName) => tagName !== tag),
        ]);
        setSearchTag("");
        const elem = document.activeElement as HTMLElement;
        elem?.blur();
    }

    async function validateTagAddition() {
        const normalized = searchTag.toLowerCase().replace(/\s/g, "");
        if (validate) {
            const ok = await validate(normalized);
            if (ok) {
                addTag(normalized);
                setTagValidateResult(true);
                setSearchTag("");
                const elem = document.activeElement as HTMLElement;
                elem?.blur();
            } else {
                setTagValidateResult(false);
            }
        } else {
            addTag(normalized);
        }
    }

    function removeTag(tag: string) {
        setAvailableTags([...(availableTags ?? []), tag]);
        onChange(value.filter((tagName) => tagName !== tag));
    }

    return (
        <div className="dropdown container">
            <input
                type="text"
                placeholder="Add tags"
                value={searchTag}
                onChange={(e) => {
                    setTagValidateResult(undefined);
                    setSearchTag(
                        e.currentTarget.value.toLowerCase().replace(/\s/g, ""),
                    );
                }}
                className="input input-ghost"
            />
            <ul
                tabIndex={0}
                className="dropdown-content menu max-h-[24rem] overflow-auto shadow bg-base-200 rounded-box z-50"
            >
                <span className="flex flex-wrap">
                    {matches ? (
                        filteredTags.map((tag: string, index: number) => (
                            <Fragment key={index}>
                                <li onClick={() => addTag(tag)}>
                                    <a>{tag}</a>
                                </li>
                            </Fragment>
                        ))
                    ) : (
                        <li>
                            <a onClick={validateTagAddition}>
                                {" "}
                                {tagValidateResult === undefined
                                    ? "Click here to add your custom tag"
                                    : !tagValidateResult
                                      ? "Tag contains malicious or nonsense word. Try again."
                                      : "Click here to add your custom tag"}
                            </a>
                        </li>
                    )}
                </span>
            </ul>
            <div className="flex flex-wrap items-center gap-4">
                {value &&
                    value.map((tag: string, index: number) => (
                        <Fragment key={index}>
                            <div className="flex flex-wrap items-center space-x-2">
                                <p className="text-lg rounded link-primary">
                                    #{tag}
                                </p>
                                <p
                                    className="text-red-400 cursor-pointer"
                                    onClick={() => removeTag(tag)}
                                >
                                    x
                                </p>
                            </div>
                        </Fragment>
                    ))}
                <p className="text-sm">Up to {maxTags} tags only</p>
            </div>
        </div>
    );
}
