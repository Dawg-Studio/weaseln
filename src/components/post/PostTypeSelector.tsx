"use client";
import { PostDraft } from "@/generated/prisma/client";
import { Organization } from "@/generated/prisma/client";
import React, { useState } from "react";
import {
    faBuilding,
    faChevronDown,
    faFeather,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Tiptap from "../wysiwyg/Tiptap";
interface SelectedOrg {
    orgName: string;
    org?: Organization | null;
}
const PostTypeSelector = ({
    userId,
    username,
    tags,
    editOrDraft,
    mode,
    orgs,
    ownOrg,
}: {
    userId?: string;
    username?: string | null | undefined;
    tags: string[];
    editOrDraft?: PostDraft;
    mode?: "edit" | "draft";
    orgs?: Organization[];
    ownOrg?: Organization[];
}) => {
    const combinedOrgs = [...(orgs ?? []), ...(ownOrg ?? [])];
    const [selectOrg, setSelectOrg] = useState<SelectedOrg>({
        orgName: "",
    });
    const [selectTipTap, setSelectTipTap] = useState(false);
    return (
        <>
            {selectTipTap || combinedOrgs.length === 0 ? (
                <Tiptap
                    userId={userId}
                    username={username}
                    editOrDraft={editOrDraft}
                    mode={mode}
                    tags={tags}
                    selectedOrg={selectOrg.org ?? null}
                />
            ) : (
                <div className="hero brand-wash brand-dots bg-base-200 hairline-b min-h-screen">
                    <div className="hero-content enter flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
                        <div className="card card-compact md:w-96 w-72 rounded-box border border-hairline bg-surface elev-2 transition-shadow duration-200 ease-burrow hover:elev-3 py-5 min-h-96">
                            <div className="card-body gap-3">
                                <span
                                    aria-hidden="true"
                                    className="grid size-10 place-items-center rounded-field bg-tint text-primary"
                                >
                                    <FontAwesomeIcon
                                        icon={faBuilding}
                                        className="w-4"
                                    />
                                </span>
                                <span className="text-eyebrow uppercase text-muted">
                                    Organization
                                </span>
                                <h3 className="card-title text-headline text-base-content">
                                    Promote Your Business or Cause
                                </h3>
                                <p className="text-sm text-base-content/70">
                                    Create engaging content to share your
                                    organization&apos;s updates, insights, and
                                    events. Connect with your professional
                                    audience and enhance your brand&apos;s
                                    presence.
                                </p>
                                <div className="dropdown mt-1">
                                    <div
                                        tabIndex={0}
                                        role="button"
                                        className="btn btn-outline h-11 min-h-11 w-full justify-between gap-2 rounded-field border-hairline-strong bg-surface px-4 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint hover:text-base-content"
                                    >
                                        <span className="truncate">
                                            {selectOrg?.orgName
                                                ? selectOrg.orgName
                                                : "Choose Organization"}
                                        </span>
                                        <FontAwesomeIcon
                                            icon={faChevronDown}
                                            aria-hidden="true"
                                            className="w-3 shrink-0 text-muted"
                                        />
                                    </div>
                                    <ul
                                        tabIndex={0}
                                        className="dropdown-content z-[1] menu mt-1 max-h-64 w-56 gap-0.5 overflow-y-auto rounded-box border border-hairline bg-surface p-2 elev-3"
                                    >
                                        {combinedOrgs?.map((org) => (
                                            <li
                                                key={org.id}
                                                onClick={() =>
                                                    setSelectOrg({
                                                        org: org,
                                                        orgName: org.name,
                                                    })
                                                }
                                            >
                                                <p className="text-sm font-medium">
                                                    {org.name}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="card-actions mt-auto justify-end">
                                    <button
                                        className="btn btn-primary h-11 min-h-11 rounded-field border-0 px-5 text-sm font-semibold elev-1 press hover:elev-2 disabled:pointer-events-none disabled:opacity-45"
                                        disabled={selectOrg?.orgName === ""}
                                        onClick={() => setSelectTipTap(true)}
                                    >
                                        Start Posting
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="card card-compact md:w-96 w-72 rounded-box border border-hairline bg-surface elev-2 transition-shadow duration-200 ease-burrow hover:elev-3 py-5 min-h-96">
                            <div className="card-body gap-3">
                                <span
                                    aria-hidden="true"
                                    className="grid size-10 place-items-center rounded-field bg-tint-warm text-base-content"
                                >
                                    <FontAwesomeIcon
                                        icon={faFeather}
                                        className="w-4"
                                    />
                                </span>
                                <span className="text-eyebrow uppercase text-muted">
                                    Personal
                                </span>
                                <h2 className="card-title text-headline text-base-content">
                                    Post for Personal
                                </h2>
                                <p className="text-sm text-base-content/70">
                                    Express your thoughts, experiences, and
                                    personal updates. Connect with friends,
                                    family, and followers on a more intimate
                                    level.
                                </p>
                                <div className="card-actions mt-auto justify-end">
                                    <button
                                        className="btn btn-outline h-11 min-h-11 rounded-field border-hairline-strong bg-transparent px-5 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint hover:text-base-content"
                                        onClick={() => {
                                            setSelectOrg({
                                                orgName: "",
                                                org: null,
                                            });
                                            setSelectTipTap(true);
                                        }}
                                    >
                                        Start Posting
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PostTypeSelector;
