import { createHash, timingSafeEqual } from "crypto";

/**
 * The challenge a client sends at the authorization endpoint and the verifier
 * it sends at the token endpoint. The server checks that the verifier hashes
 * to the challenge, so an intercepted code cannot be redeemed without the
 * secret the client kept.
 */
export function s256(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkceChallenge(input: {
    challenge: string;
    method: string;
    verifier: string;
}): boolean {
    // `plain` is not accepted: it would make the code replayable by anyone
    // who saw it.
    if (input.method !== "S256") return false;
    const expected = Buffer.from(s256(input.verifier));
    const presented = Buffer.from(input.challenge);
    if (expected.length !== presented.length) return false;
    return timingSafeEqual(expected, presented);
}
