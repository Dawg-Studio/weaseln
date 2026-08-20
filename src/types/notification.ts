type UserNotificationInputValidation = {
    userId: string;
    fromUserId: string;
    from?: string | null;
    fromImage?: string | null;
    message: string;
    postId?: string;
    actionUrl: string;
};

export type { UserNotificationInputValidation };
