"use client";

import { cn } from "@/utils/cn";
import React, { forwardRef } from "react";

type ModalProps = React.HTMLAttributes<HTMLDivElement>;
const Modal = forwardRef<HTMLDialogElement, ModalProps>(
    ({ className, children }, ref) => {
        return (
            <dialog
                // daisyUI paints .modal[open] with a flat black wash; retint it
                // with the warm ink scrim and blur the page behind it instead.
                className="modal open:bg-scrim open:backdrop-blur-[2px]"
                ref={ref}
            >
                <div
                    className={cn(
                        "modal-box rounded-box border border-hairline bg-surface text-base-content elev-4 p-6",
                        className,
                    )}
                >
                    {children}
                </div>
            </dialog>
        );
    },
);

Modal.displayName = "Modal";

export default Modal;
