export const postContainerInclude = {
    _count: {
        select: {
            reactions: true,
            comments: true,
        },
    },
    organization: {
        select: {
            id: true,
            name: true,
            image: true,
            username: true,
        },
    },
};
