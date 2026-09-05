"use client";

import "./custom_css/placeholder.css";
import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "../wysiwyg/custom_extensions/Image";
import TiptapLink from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import MenuBar from "./menu/MenuBar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusResponse } from "@/types/status";
import { useRouter } from "next/navigation";
import { Organization, PostDraft } from "@/generated/prisma/client";
import { cn } from "@/utils/cn";
import { validateTag } from "@/utils/actions/tag";
import tiptapExtensions from "@/utils/tiptapExt";
import { useAutosave } from "./hooks/useAutosave";
import ImageUploadForm from "./ImageUploadForm";
import TagInput from "./TagInput";
import PostStatusBanner from "./PostStatusBanner";
import {
    PreviewEditor,
    urlToFile,
    collectEditorImages,
} from "./previewUtils";

// `measure` (68ch) replaces the old `max-w-md`, which pinned the composer to a
// 28rem phone column on desktop. Matches the reading page exactly, so what the
// author types is laid out the way a reader will see it.
const prose =
    "prose prose-sm sm:prose lg:prose-lg measure mx-auto my-8 px-4 sm:px-6 focus:outline-none";

// ponytail: when QA_NO_COVER is set, the editor auto-applies a placeholder
// /covers/*.svg URL instead of requiring a real upload. The /api/post route
// detects the placeholder and stores it directly without Cloudinary.
const QA_NO_COVER = process.env.NEXT_PUBLIC_QA_NO_COVER === "1";
const DEFAULT_QA_COVERS = [
    "/covers/cover-1.svg",
    "/covers/cover-2.svg",
    "/covers/cover-3.svg",
    "/covers/cover-4.svg",
] as const;

export default function Tiptap({
    userId,
    username,
    tags,
    editOrDraft,
    mode,
    selectedOrg,
}: {
    userId?: string;
    username?: string | null | undefined;
    tags: string[];
    editOrDraft?: PostDraft;
    mode?: "edit" | "draft";
    selectedOrg?: Organization | null;
}) {
    const router = useRouter();
    const [postError, setPostError] = useState<StatusResponse | null>(null);
    // ponytail: seed the cover image with a deterministic placeholder when
    // QA_NO_COVER is set and no draft cover exists, so the publish gate
    // passes without a manual upload.
    const initialCover =
        editOrDraft?.coverImage ??
        (QA_NO_COVER ? DEFAULT_QA_COVERS[0] : "");
    const [coverImage, setCoverImage] = useState<string>(initialCover);
    const [preview, setPreview] = useState<boolean>(false);
    const [publishState, setPublishState] = useState<boolean>(false);
    const [inputTags, setInputTags] = useState<string[]>(
        editOrDraft?.tags ?? [],
    );
    const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);

    const draftTags = editOrDraft?.tags;
    const tagList = useMemo(() => {
        if (!draftTags) return tags;
        let result = tags;
        draftTags.forEach((tagDraft) => {
            result = result.filter((tag) => tag !== tagDraft);
        });
        return result;
    }, [draftTags, tags]);

    const extensions = tiptapExtensions(["Image", "Link", "Youtube"]);
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            ...extensions,
            Placeholder,
            TiptapImage.configure({
                HTMLAttributes: { class: "mx-auto" },
            }),
            TiptapLink.extend({ inclusive: false }),
            Youtube.configure({
                HTMLAttributes: { class: "mx-auto" },
            }),
        ],
        content: (editOrDraft?.content as JSONContent) ?? "",
        editorProps: {
            attributes: { class: prose, "aria-label": "Post body" },
        },
    });

    const editorRef = useRef(editor);
    useEffect(() => {
        editorRef.current = editor;
    });

    const editorTitle = useEditor({
        immediatelyRender: false,
        extensions: [
            Placeholder.configure({ placeholder: "Your title here" }),
            StarterKit,
        ],
        content: `<h1>${editOrDraft?.title ?? ""}</h1>`,
        editorProps: { attributes: { class: prose, "aria-label": "Post title" } },
    });

    const editorDescription = useEditor({
        immediatelyRender: false,
        extensions: [
            Placeholder.configure({ placeholder: "A discerning description" }),
            StarterKit,
        ],
        content: `<h4>${editOrDraft?.description ?? ""}</h4>`,
        editorProps: {
            attributes: { class: prose, "aria-label": "Post description" },
        },
    });

    useEffect(() => {
        editorTitle?.commands.setHeading({ level: 1 });
        editorDescription?.commands.setHeading({ level: 4 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorDescription?.$doc.textContent, editorTitle?.$doc.textContent]);

    const saveDraft = useCallback(
        async (content: string) => {
            if (publishState) return;
            const formData = new FormData();
            // ponytail: QA_NO_COVER sends the placeholder URL as a string so
            // the server skips Cloudinary.
            const isPlaceholderUrl =
                typeof coverImage === "string" &&
                coverImage.length > 0 &&
                (coverImage.startsWith("/covers/") ||
                    coverImage.startsWith("http"));
            const coverFile =
                coverImage && !isPlaceholderUrl
                    ? await urlToFile(coverImage, "img_cover")
                    : null;
            if (isPlaceholderUrl) {
                formData.append("coverImage", coverImage);
            } else if (coverFile) {
                formData.append("coverImage", coverFile);
            }

            const images = await collectEditorImages(editorRef.current);
            if (images.length !== 0) {
                formData.append(
                    "image_total",
                    images.length as unknown as string,
                );
                for (const [index, image] of Object.entries(images)) {
                    formData.append(`image_${index}`, image);
                }
            }

            formData.append("title", editorTitle?.getText() ?? "");
            formData.append("description", editorDescription?.getText() ?? "");
            formData.append("content", content);
            formData.append("tags", JSON.stringify(inputTags));
            formData.append("org", JSON.stringify(selectedOrg));

            await fetch("/api/post/draft", {
                method: "POST",
                body: formData,
            });
        },
        [
            coverImage,
            editorTitle,
            editorDescription,
            inputTags,
            selectedOrg,
            publishState,
        ],
    );

    const { save, status: saveStatus } = useAutosave({ onSave: saveDraft });
    const isAutoSavingDraft = saveStatus === "saving";

    useEffect(() => {
        const ed = editor;
        const edTitle = editorTitle;
        const edDesc = editorDescription;
        if (!ed) return;
        const trigger = () => save(JSON.stringify(ed.getJSON()));
        ed.on("update", trigger);
        edTitle?.on("update", trigger);
        edDesc?.on("update", trigger);
        return () => {
            ed.off("update", trigger);
            edTitle?.off("update", trigger);
            edDesc?.off("update", trigger);
        };
    }, [editor, editorTitle, editorDescription, save]);

    const coverImageInitRef = useRef(true);
    useEffect(() => {
        if (coverImageInitRef.current) {
            coverImageInitRef.current = false;
            if (!editor || !coverImage) return;
            return;
        }
        if (!editor || !coverImage) return;
        save(JSON.stringify(editor.getJSON()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coverImage]);

    const inputTagsInitRef = useRef(true);
    useEffect(() => {
        if (inputTagsInitRef.current) {
            inputTagsInitRef.current = false;
            if (!editor || !inputTags) return;
            return;
        }
        if (!editor || !inputTags) return;
        save(JSON.stringify(editor.getJSON()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputTags]);

    function togglePreview() {
        setPreview((prev) => !prev);
    }

    async function uploadPost(publish: boolean) {
        if (isAutoSavingDraft) return;
        if (!publish) setIsSavingDraft(true);
        setPublishState(true);
        const json = editor?.getJSON();
        const formData = new FormData();
        // ponytail: QA_NO_COVER sends the placeholder URL as a string so the
        // server skips Cloudinary and stores the local path directly.
        const isPlaceholderUrl =
            typeof coverImage === "string" &&
            coverImage.length > 0 &&
            (coverImage.startsWith("/covers/") ||
                coverImage.startsWith("http"));
        const coverFile =
            coverImage && !isPlaceholderUrl
                ? await urlToFile(coverImage, "img_cover")
                : null;
        if (isPlaceholderUrl) {
            formData.append("coverImage", coverImage);
        } else if (coverFile) {
            formData.append("coverImage", coverFile);
        }

        const images = await collectEditorImages(editorRef.current);
        if (images.length !== 0) {
            formData.append(
                "image_total",
                images.length as unknown as string,
            );
            for (const [index, image] of Object.entries(images)) {
                formData.append(`image_${index}`, image);
            }
        }
        if (mode === "edit") {
            formData.append("postId", editOrDraft?.id!);
        }
        formData.append("username", username ? username : "");
        formData.append("title", editorTitle?.getText() ?? "");
        formData.append("description", editorDescription?.getText() ?? "");
        formData.append("content", JSON.stringify(json));
        formData.append("series", "test");
        formData.append("tags", JSON.stringify(inputTags));
        const readPerMinute = Math.round(
            (editor?.storage.characterCount.words() ?? 0) / 238,
        );
        formData.append("readPerMinute", readPerMinute as unknown as string);
        formData.append("published", publish ? "true" : "false");
        formData.append("orgId", selectedOrg?.id ?? "");

        const passed = await checkPostRequirements();
        if (passed) {
            const res = await fetch("/api/post", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                setPublishState(false);
                if (!publish) setIsSavingDraft(false);
                setPostError({
                    ok: res.ok,
                    status: res.status,
                    statusText: res.statusText,
                    message: "Something went wrong, please try again later.",
                });
            } else {
                const result = await res.json();
                if (result) {
                    router.push(
                        publish
                            ? `/${username ?? userId}/${result.data}`
                            : `/${username ?? userId}/${result.data}/edit`,
                    );
                }
            }
        }
    }

    async function checkPostRequirements() {
        const wordsRequired = (editor?.storage.characterCount.words() ?? 0) >= 50;
        // ponytail: cover is optional — see AGENTS.md.
        const required: { [key: string]: boolean } = {
            title: !!editorTitle?.getText(),
            description: !!editorDescription?.getText(),
            wordsRequired: !!wordsRequired,
        };

        const requiredItems: string[] = [];
        for (const key in required) {
            if (Object.prototype.hasOwnProperty.call(required, key)) {
                if (!required[key]) requiredItems.push(key);
            }
        }
        if (requiredItems.length !== 0) {
            setPublishState(false);
            setPostError({
                ok: false,
                status: 499,
                statusText: "Required Fields",
                message:
                    requiredItems.filter((item) => item !== "wordsRequired")
                        .length !== 0
                        ? `The following fields: ${requiredItems.filter(
                              (item) => item !== "wordsRequired",
                          )} cannot be blank.`
                        : !wordsRequired
                          ? "Insufficient words, need a minimum of 50 words to publish."
                          : "",
            });
            return false;
        }
        return true;
    }

    return (
        <>
            {/* ponytail: this bar used to be `z-50 sticky top-0`, which put it
                ABOVE the navbar (Navigation.tsx is `sticky top-0 z-30
                min-h-16`) and covered it on /[userId]/[slug]/edit. Park it
                below the 64px nav at a lower stacking order instead. */}
            <div className="glass-nav sticky top-16 z-20 rounded-t-box hairline-b">
                <div className="flex flex-wrap justify-center p-2">
                    <div className="flex items-center overflow-auto gap-3">
                        <ImageUploadForm onUpload={setCoverImage} />
                        <button
                            className={cn(
                                "btn h-11 min-h-11 rounded-field px-5 text-sm font-semibold press",
                                preview
                                    ? "border-primary bg-tint text-base-content hover:border-primary hover:bg-tint-strong"
                                    : "btn-outline border-hairline-strong bg-transparent text-base-content hover:border-primary hover:bg-tint hover:text-base-content",
                            )}
                            onClick={togglePreview}
                        >
                            {preview ? "Edit" : "Preview"}
                        </button>
                        <button
                            className="btn btn-outline h-11 min-h-11 rounded-field border-hairline-strong bg-transparent px-5 text-sm font-semibold text-base-content press hover:border-primary hover:bg-tint hover:text-base-content"
                            disabled={
                                publishState ||
                                isAutoSavingDraft ||
                                isSavingDraft
                            }
                            onClick={() => uploadPost(false)}
                        >
                            {isSavingDraft && (
                                <span className="loading loading-spinner"></span>
                            )}
                            {isSavingDraft ? "Saving..." : "Save as Draft"}
                        </button>
                        {/* The one filled action in the composer. */}
                        <button
                            className="btn btn-primary h-11 min-h-11 rounded-field border-0 px-5 text-sm font-semibold elev-1 press hover:elev-2"
                            disabled={publishState || isAutoSavingDraft}
                            onClick={() => uploadPost(true)}
                        >
                            {publishState
                                ? mode === "edit"
                                    ? "Updating"
                                    : "Publishing..."
                                : mode === "edit"
                                  ? "Update"
                                  : isAutoSavingDraft
                                    ? "Saving..."
                                    : "Publish"}
                        </button>
                    </div>
                </div>
            </div>
            <PostStatusBanner postError={postError} />
            {preview ? (
                <PreviewEditor
                    editor={editor}
                    editorTitle={editorTitle}
                    editorDescription={editorDescription}
                    coverImage={coverImage}
                    inputTags={inputTags}
                />
            ) : (
                <>
                    <EditorContent editor={editorTitle} />
                    <EditorContent editor={editorDescription} />
                    <div className={cn("!mb-2", prose)}>
                        <TagInput
                            value={inputTags}
                            onChange={setInputTags}
                            tagList={tagList}
                            validate={validateTag}
                        />
                    </div>
                    {/* The toolbar and the body are one sheet — a warm
                        hairline card on the canvas, matching `field-input`.
                        No `overflow-hidden` here: it would break the
                        toolbar's `sticky` positioning. */}
                    <div className="measure mx-auto mt-2 mb-24 px-4 sm:px-6">
                        <div className="rounded-box border border-hairline bg-surface">
                            {/* top-31 (124px) = the 64px navbar plus this
                                file's own 61px publish bar, so the formatting
                                toolbar parks directly under both instead of
                                sliding beneath them. */}
                            <MenuBar
                                editor={editor}
                                className="w-full top-31"
                            />
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
