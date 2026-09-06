import QueryWrapper from "@/components/provider/QueryWrapper";
import PostManageTable from "@/components/post/PostManageTable";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signInUrl } from "@/utils/signInUrl";

export default async function ManagePosts() {
    const session = await auth();
    if (!session?.user) redirect(signInUrl("/manage/posts"));

    return (
        <div className="container">
            <QueryWrapper>
                <PostManageTable />
            </QueryWrapper>
        </div>
    );
}
