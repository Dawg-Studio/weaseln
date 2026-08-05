import { StatusResponse } from "@/types/status";
import StatusNotif from "@/components/StatusNotif";

export default function PostStatusBanner({
    postError,
}: {
    postError: StatusResponse | null;
}) {
    if (!postError) return null;
    return <StatusNotif {...postError} />;
}
