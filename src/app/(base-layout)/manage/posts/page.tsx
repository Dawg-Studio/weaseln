import QueryWrapper from "@/components/provider/QueryWrapper";
import PostManageTable from "@/components/post/PostManageTable";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ManagePosts() {
    const session = await auth();
    if (!session?.user) redirect("/api/auth/signin");

    return (
        <div className="container">
            <QueryWrapper>
                <PostManageTable />
            </QueryWrapper>
        </div>
    );
}
