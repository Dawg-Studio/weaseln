/**
 * The download path for a resume the viewer is allowed to have. The owner
 * always gets their own; a stranger only gets a published one. `null` means
 * there is nothing to link to.
 */
export function resumeDownloadUrl(
    user: { id: string; resumeUrl: string | null; resumePublic: boolean },
    isOwner: boolean,
): string | null {
    if (!user.resumeUrl) return null;
    if (!user.resumePublic && !isOwner) return null;
    return `/api/portfolio/resume/download?userId=${encodeURIComponent(user.id)}`;
}
