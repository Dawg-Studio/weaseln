import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { EditorContentProps, Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
    faBold,
    faItalic,
    faStrikethrough,
    faCode,
    faMarker,
    faHeading,
    faListUl,
    faListOl,
    faListCheck,
    faFileCode,
    faQuoteLeft,
    faRulerHorizontal,
    faLink,
    faImage,
    faEllipsis,
} from "@fortawesome/free-solid-svg-icons";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type MenuBarProps = React.ButtonHTMLAttributes<HTMLDivElement>;

type MenuItem = {
    icon: IconDefinition;
    title: string;
    actionKey: string;
    activeKey?: string;
};

const ACTION_KEYS = {
    bold: "bold",
    italic: "italic",
    strike: "strike",
    highlight: "highlight",
    heading: "heading",
    bulletList: "bulletList",
    orderedList: "orderedList",
    taskList: "taskList",
    code: "code",
    codeBlock: "codeBlock",
    blockquote: "blockquote",
    horizontalRule: "horizontalRule",
    insertImage: "insertImage",
    link: "link",
} as const;

const ACTIVE_KEYS = {
    bold: "bold",
    italic: "italic",
    strike: "strike",
    highlight: "highlight",
    heading: "heading",
    bulletList: "bulletList",
    orderedList: "orderedList",
    taskList: "taskList",
    code: "code",
    codeBlock: "codeBlock",
    blockquote: "blockquote",
} as const;

function runEditorAction(editor: Editor | null, key: string): void {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (key) {
        case ACTION_KEYS.bold:
            chain.toggleBold().run();
            break;
        case ACTION_KEYS.italic:
            chain.toggleItalic().run();
            break;
        case ACTION_KEYS.strike:
            chain.toggleStrike().run();
            break;
        case ACTION_KEYS.highlight:
            chain.toggleHighlight().run();
            break;
        case ACTION_KEYS.heading:
            chain.toggleHeading({ level: 2 }).run();
            break;
        case ACTION_KEYS.bulletList:
            chain.toggleBulletList().run();
            break;
        case ACTION_KEYS.orderedList:
            chain.toggleOrderedList().run();
            break;
        case ACTION_KEYS.taskList:
            chain.toggleTaskList().run();
            break;
        case ACTION_KEYS.code:
            chain.toggleCode().run();
            break;
        case ACTION_KEYS.codeBlock:
            chain.toggleCodeBlock().run();
            break;
        case ACTION_KEYS.blockquote:
            chain.toggleBlockquote().run();
            break;
        case ACTION_KEYS.horizontalRule:
            chain.setHorizontalRule().run();
            break;
        case ACTION_KEYS.insertImage:
            document.getElementById("insertImage")?.click();
            break;
    }
}

export default function MenuBar({
    asComment,
    editor,
    className,
}: EditorContentProps & MenuBarProps & { asComment?: true }) {
    const [insertedLink, setInsertedLink] = useState<string>("");
    const link_modal = useRef<HTMLDialogElement>(null);

    const editorRef = useRef(editor);
    useEffect(() => {
        editorRef.current = editor;
    });

    const editorState = useEditorState({
        editor,
        selector: ({ editor }) => ({
            isBold: editor?.isActive("bold") ?? false,
            isItalic: editor?.isActive("italic") ?? false,
            isStrike: editor?.isActive("strike") ?? false,
            isHighlight: editor?.isActive("highlight") ?? false,
            isHeading: editor?.isActive("heading", { level: 2 }) ?? false,
            isBulletList: editor?.isActive("bulletList") ?? false,
            isOrderedList: editor?.isActive("orderedList") ?? false,
            isTaskList: editor?.isActive("taskList") ?? false,
            isCode: editor?.isActive("code") ?? false,
            isCodeBlock: editor?.isActive("codeBlock") ?? false,
            isBlockquote: editor?.isActive("blockquote") ?? false,
        }),
    });

    const isActive = (key?: string): boolean => {
        if (!key || !editorState) return false;
        switch (key) {
            case ACTIVE_KEYS.bold:
                return editorState.isBold;
            case ACTIVE_KEYS.italic:
                return editorState.isItalic;
            case ACTIVE_KEYS.strike:
                return editorState.isStrike;
            case ACTIVE_KEYS.highlight:
                return editorState.isHighlight;
            case ACTIVE_KEYS.heading:
                return editorState.isHeading;
            case ACTIVE_KEYS.bulletList:
                return editorState.isBulletList;
            case ACTIVE_KEYS.orderedList:
                return editorState.isOrderedList;
            case ACTIVE_KEYS.taskList:
                return editorState.isTaskList;
            case ACTIVE_KEYS.code:
                return editorState.isCode;
            case ACTIVE_KEYS.codeBlock:
                return editorState.isCodeBlock;
            case ACTIVE_KEYS.blockquote:
                return editorState.isBlockquote;
            default:
                return false;
        }
    };

    const handleAction = useCallback((key: string) => {
        const ed = editorRef.current;
        if (key === ACTION_KEYS.link) {
            const prevLink = ed?.getAttributes("link").href;
            if (prevLink) {
                ed?.chain().focus().extendMarkRange("link").unsetLink().run();
            } else {
                link_modal.current?.show();
            }
            return;
        }
        runEditorAction(ed, key);
    }, []);

    const handleInsertImage = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!event.target.files) return;
            if (event.target.files[0]) {
                const image = URL.createObjectURL(event.target.files[0]);
                editorRef.current
                    ?.chain()
                    .focus()
                    .setImage({ src: image as string })
                    .run();
            }
        },
        [],
    );

    const handleInsertLink = useCallback(() => {
        if (!insertedLink) return;
        if (insertedLink === "") {
            editorRef.current
                ?.chain()
                .focus()
                .extendMarkRange("link")
                .unsetLink()
                .run();
        }
        editorRef.current
            ?.chain()
            .focus()
            .extendMarkRange("link")
            .setLink({
                href:
                    insertedLink.includes("http://") ||
                    insertedLink.includes("https://")
                        ? insertedLink
                        : (`https://${insertedLink}` as string),
                target: "_blank",
            })
            .run();
        link_modal.current?.close();
    }, [insertedLink]);

    const displayItems: MenuItem[] = [
        {
            icon: faBold,
            title: "Bold",
            actionKey: ACTION_KEYS.bold,
            activeKey: ACTIVE_KEYS.bold,
        },
        {
            icon: faHeading,
            title: "Heading 1",
            actionKey: ACTION_KEYS.heading,
            activeKey: ACTIVE_KEYS.heading,
        },
        {
            icon: faItalic,
            title: "Italic",
            actionKey: ACTION_KEYS.italic,
            activeKey: ACTIVE_KEYS.italic,
        },
        {
            icon: faStrikethrough,
            title: "Strike",
            actionKey: ACTION_KEYS.strike,
            activeKey: ACTIVE_KEYS.strike,
        },
        {
            icon: faLink,
            title: "Link",
            actionKey: ACTION_KEYS.link,
        },
        {
            icon: faMarker,
            title: "Highlight",
            actionKey: ACTION_KEYS.highlight,
            activeKey: ACTIVE_KEYS.highlight,
        },
        {
            icon: faListUl,
            title: "Bullet List",
            actionKey: ACTION_KEYS.bulletList,
            activeKey: ACTIVE_KEYS.bulletList,
        },
        {
            icon: faListOl,
            title: "Ordered List",
            actionKey: ACTION_KEYS.orderedList,
            activeKey: ACTIVE_KEYS.orderedList,
        },
        {
            icon: faListCheck,
            title: "Task List",
            actionKey: ACTION_KEYS.taskList,
            activeKey: ACTIVE_KEYS.taskList,
        },
    ];

    const dropdownItems: MenuItem[] = [
        {
            icon: faCode,
            title: "Code",
            actionKey: ACTION_KEYS.code,
            activeKey: ACTIVE_KEYS.code,
        },
        {
            icon: faFileCode,
            title: "Code Block",
            actionKey: ACTION_KEYS.codeBlock,
            activeKey: ACTIVE_KEYS.codeBlock,
        },
        {
            icon: faQuoteLeft,
            title: "Blockquote",
            actionKey: ACTION_KEYS.blockquote,
            activeKey: ACTIVE_KEYS.blockquote,
        },
        {
            icon: faRulerHorizontal,
            title: "Horizontal Rule",
            actionKey: ACTION_KEYS.horizontalRule,
        },
        {
            icon: faImage,
            title: "Insert Image",
            actionKey: ACTION_KEYS.insertImage,
        },
    ];

    return (
        <div className={cn("sticky top-14 z-10 bg-base-100", className)}>
            <dialog ref={link_modal} className="modal">
                <div className="modal-box">
                    <div className="flex justify-center flex-wrap space-y-4 p-4">
                        <input
                            type="text"
                            placeholder="URL..."
                            className="input input-bordered w-full max-w-xs"
                            onChange={(e) =>
                                setInsertedLink(e.currentTarget.value)
                            }
                            value={insertedLink}
                        />
                        <button className="btn" onClick={handleInsertLink}>
                            Insert Link
                        </button>
                    </div>
                    <div className="modal-action">
                        <form method="dialog">
                            {/* if there is a button in form, it will close the modal */}
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            <input
                type="file"
                id="insertImage"
                accept="image/png, image/jpeg"
                onChange={handleInsertImage}
                value={""}
                hidden
            />
            <div className="flex lg:justify-center">
                <div className="flex-1 items-center">
                    {displayItems.map((item) => (
                        <Fragment key={item.title}>
                            <button
                                className={`btn btn-ghost ${
                                    isActive(item.activeKey) ? "btn-active" : ""
                                }`}
                                onClick={() => handleAction(item.actionKey)}
                                title={item.title}
                            >
                                <FontAwesomeIcon icon={item.icon} />
                            </button>
                        </Fragment>
                    ))}
                </div>
                <div className="flex justify-end">
                    <div className="dropdown dropdown-bottom dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost">
                            <FontAwesomeIcon icon={faEllipsis} />
                        </label>
                        <div
                            tabIndex={0}
                            className="flex dropdown-content z-[1] shadow bg-base-100 rounded-sm"
                        >
                            {dropdownItems.map((item) => (
                                <Fragment key={item.title}>
                                    {!(
                                        asComment &&
                                        item.icon === faImage
                                    ) && (
                                        <button
                                            className={`btn btn-ghost ${
                                                isActive(item.activeKey)
                                                    ? "btn-active"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleAction(item.actionKey)
                                            }
                                            title={item.title}
                                        >
                                            <FontAwesomeIcon
                                                icon={item.icon}
                                            />
                                        </button>
                                    )}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
