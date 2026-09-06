import QueryWrapper from "@/components/provider/QueryWrapper";
import SeriesManageContainer from "@/app/(base-layout)/manage/series/_components/SeriesManageContainer";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signInUrl } from "@/utils/signInUrl";

export default async function ManageSeries() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/manage/series"));

    return (
        <>
            <QueryWrapper>
                <SeriesManageContainer />
            </QueryWrapper>
        </>
    );
}
