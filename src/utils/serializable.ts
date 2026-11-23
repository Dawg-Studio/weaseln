import prisma from "@/db";
import { Prisma } from "@/generated/prisma/client";

/**
 * How many times a serialization failure is retried before the write gives
 * up. Three is enough for two writers colliding on one row.
 */
const MAX_ATTEMPTS = 3;

function isSerializationFailure(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: unknown }).code === "P2034"
    );
}

/**
 * A read-then-write that two requests could interleave on.
 *
 * At the serializable isolation level the second writer is told to start
 * over instead of overwriting what the first one wrote, and the retry happens
 * here so the caller never sees a conflict.
 */
export async function serializable<T>(
    write: (_tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await prisma.$transaction(write, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (err) {
            if (!isSerializationFailure(err) || attempt >= MAX_ATTEMPTS) {
                throw err;
            }
        }
    }
}
