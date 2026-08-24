import { StatusResponse } from "@/types/status";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function StatusNotif({
    ok,
    status,
    statusText,
    message,
}: StatusResponse) {
    return (
        <>
            {!ok && typeof ok !== "undefined" && (
                <div
                    className="enter-fade my-4 flex items-start gap-3 rounded-box border border-error/40 bg-error/10 px-4 py-3 text-base-content elev-1"
                    role="alert"
                >
                    <FontAwesomeIcon
                        icon={faCircleExclamation}
                        aria-hidden="true"
                        className="mt-0.5 w-4 shrink-0 text-error"
                    />
                    <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-bold text-error">
                            {status}: {statusText}
                        </p>
                        <p className="text-sm text-base-content/80">
                            {message}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
