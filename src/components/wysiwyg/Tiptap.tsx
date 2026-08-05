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
import { Organization, PostDraft } from "@prisma/client";
import { cn } from "@/utils/cn";
import { validateTag } from "@/utils/actions/tag";
import { autocompleteGemini } from "@/utils/actions/wysiwyg";
import { AutocompleteGemini } from "./custom_extensions/autocomplete";
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

const prose =
    "prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto mt-8 mb-8 mr-4 ml-4 sm:mr-auto sm:ml-auto max-w-md focus:outline-none";

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
    const [coverImage, setCoverImage] = useState<string>(
        editOrDraft?.coverImage ?? "",
    );
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

    const [insertContentState, setInsertContentState] =
        useState<boolean>(false);
    const insertContentTimeout = useRef<NodeJS.Timeout>(undefined);

    const extensions = tiptapExtensions(["Image", "Link", "Youtube"]);
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            ...extensions,
            Placeholder,
            AutocompleteGemini,
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
            attributes: { class: prose },
            handleKeyDown(view, event) {
                if (event.key === "Tab") {
                    if (!insertContentState) {
                        event.preventDefault();
                        setInsertContentState(true);
                    }
                } else {
                    clearTimeout(insertContentTimeout.current);
                    setInsertContentState(false);
                }
            },
        },
    });

    const editorRef = useRef(editor);
    useEffect(() => {
        editorRef.current = editor;
    });

    const insertContentRef = useRef<(_words: string) => Promise<void>>(
        async (_words: string) => {},
    );
    useEffect(() => {
        insertContentRef.current = async (words: string) => {
            const ed = editorRef.current;
            if (!ed) return;
            ed.extensionStorage.AutocompleteExtension.autosuggestion =
                '<span class="generating"><span>&#x2022;</span><span>&#x2022;</span><span>&#x2022;</span></span>';
            ed.commands.setMeta("triggerSuggestion", true);
            const autocomplete = await autocompleteGemini(words);
            if (autocomplete) {
                ed.extensionStorage.AutocompleteExtension.autosuggestion =
                    autocomplete;
            } else {
                ed.extensionStorage.AutocompleteExtension.autosuggestion = "";
            }
            ed.commands.setMeta("triggerSuggestion", false);
        };
    });

    useEffect(() => {
        if (!insertContentState) return;
        const ed = editorRef.current;
        if (!ed) return;
        const prompt = ed.getText();
        if (!prompt) return;
        const timeoutId = setTimeout(async () => {
            setInsertContentState(false);
            await insertContentRef.current(prompt);
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [insertContentState]);

    const editorTitle = useEditor({
        immediatelyRender: false,
        extensions: [
            Placeholder.configure({ placeholder: "Your title here" }),
            StarterKit,
        ],
        content: `<h1>${editOrDraft?.title ?? ""}</h1>`,
        editorProps: { attributes: { class: prose } },
    });

    const editorDescription = useEditor({
        immediatelyRender: false,
        extensions: [
            Placeholder.configure({ placeholder: "A discerning description" }),
            StarterKit,
        ],
        content: `<h4>${editOrDraft?.description ?? ""}</h4>`,
        editorProps: { attributes: { class: prose } },
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
            const coverFile = coverImage
                ? await urlToFile(coverImage, "img_cover")
                : null;
            if (coverFile) formData.append("coverImage", coverFile);

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

    useEffect(() => {
        if (!editor) return;
        save(JSON.stringify(editor.getJSON()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coverImage]);

    function togglePreview() {
        setPreview((prev) => !prev);
    }

    async function uploadPost(publish: boolean) {
        if (isAutoSavingDraft) return;
        if (!publish) setIsSavingDraft(true);
        setPublishState(true);
        const json = editor?.getJSON();
        const formData = new FormData();
        const coverFile = coverImage
            ? await urlToFile(coverImage, "img_cover")
            : null;
        if (coverFile) formData.append("coverImage", coverFile);

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
        const required: { [key: string]: boolean } = {
            title: !!editorTitle?.getText(),
            description: !!editorDescription?.getText(),
            coverImage: !!coverImage,
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
            <div className=" z-50 sticky top-0 bg-base-100 rounded-lg">
                <div className="flex flex-wrap justify-center p-2">
                    <div className="flex items-center overflow-auto space-x-4">
                        <ImageUploadForm onUpload={setCoverImage} />
                        <button
                            className={`btn ${
                                preview ? "btn-info" : "btn-outline"
                            }`}
                            onClick={togglePreview}
                        >
                            {preview ? "Edit" : "Preview"}
                        </button>
                        <button
                            className="btn btn-outline"
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
                        <button
                            className="btn btn-success btn-outline"
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
                    <MenuBar
                        editor={editor}
                        className={cn("!mt-2", prose)}
                    />
                    <EditorContent editor={editor} className="mb-24" />
                </>
            )}
        </>
    );
}
