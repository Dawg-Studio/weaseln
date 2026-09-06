import { safeCallback } from "./safeCallback";

/* Where a visitor on /login should actually be sent.

   safeCallback only answers "did this stay on our origin", so "/login" survives
   it intact and the page hands a signed-in reader straight back to the page they
   are already standing on. That costs a wasted hop on its own, and a crafted
   ?callbackUrl=/login?callbackUrl=/login… nests it: every hop peels exactly one
   layer, so a long enough link walks the browser into ERR_TOO_MANY_REDIRECTS.

   Compare the path, not the whole string. safeCallback returns pathname + search
   + hash, so "/login?x=1" and "/login#top" are the same destination wearing a
   disguise and an equality test would wave them through. Routes *under* /login
   are out too — /login/verify is a "check your email" dead end, which is nowhere
   to park somebody who is already signed in — while "/loginhelp" is an unrelated
   route and stays allowed, which is why the test is "/login/" and not "/login".

   Absolute and traversal spellings need no handling here: safeCallback has
   already folded "https://weaseln.blog/login", "//weaseln.blog/login" and
   "/a/../login" down to the literal "/login" by the time we see them. */
export function loginDestination(raw?: string) {
    const callbackUrl = safeCallback(raw);
    const path = callbackUrl.split(/[?#]/)[0];

    return path === "/login" || path.startsWith("/login/") ? "/" : callbackUrl;
}
