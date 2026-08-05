"use client";

import { useRef, useState } from "react";
import NextImage from "next/image";
import Modal from "@/components/ui/Modal";

export default function ImageUploadForm({
    onUpload,
}: {
    onUpload: (_url: string) => void;
}) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const modalRef = useRef<HTMLDialogElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        onUpload(url);
    };

    const handleButtonClick = (event: React.MouseEvent<HTMLLabelElement>) => {
        if (previewUrl) {
            event.preventDefault();
            modalRef.current?.show();
        }
    };

    return (
        <>
            <label
                htmlFor="coverImage"
                className={`btn ${previewUrl ? "btn-info" : "btn-outline"}`}
                onClick={handleButtonClick}
            >
                {previewUrl ? "View Cover Image" : "Add Cover Image"}
            </label>
            <input
                type="file"
                id="coverImage"
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
                hidden
            />
            {previewUrl && (
                <Modal className="overflow-auto space-y-4" ref={modalRef}>
                    <NextImage
                        className="mx-auto"
                        src={previewUrl}
                        alt="image"
                        width={400}
                        height={400}
                    />
                    <label
                        htmlFor="coverImage"
                        className="btn btn-neutral flex justify-center align-middle"
                    >
                        Change
                    </label>
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </Modal>
            )}
        </>
    );
}
