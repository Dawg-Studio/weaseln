import QueryWrapper from "@/components/provider/QueryWrapper";
import SeriesManageContainer from "@/app/(base-layout)/manage/series/_components/SeriesManageContainer";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ManageSeries() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    return (
        <>
            <QueryWrapper>
                <SeriesManageContainer />
            </QueryWrapper>
        </>
    );
}
