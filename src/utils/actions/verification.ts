"use server";

import prisma from "@/db";
import { auth } from "@/auth";
import { init } from "@paralleldrive/cuid2";

// ponytail: keep the existing key generator verbatim (cuid2 init).
const createKey = init({
    length: 48,
});

export async function generateVerificationCode(userId: string) {
    const key = createKey();
    await prisma.emailVerificationCode.upsert({
        where: { userId },
        update: { key },
        create: { user: { connect: { id: userId } }, key },
    });
    return key;
}

export async function verifyEmail(userId: string, code: string) {
    const { count } = await prisma.user.updateMany({
        where: { id: userId, emailVerificationCode: { key: code } },
        data: { emailVerified: new Date() },
    });
    if (count === 0) {
        throw new Error("Invalid or expired verification code");
    }
    await prisma.emailVerificationCode.delete({ where: { userId } });
}

export const getCurrentEmailVerificationCodeDate = async () => {
    const session = await auth();
    if (!session) return null;

    const code = await prisma.emailVerificationCode.findUnique({
        where: {
            userId: session?.user.id,
        },
    });
    if (code) {
        return code.createdAt;
    } else {
        return null;
    }
};
