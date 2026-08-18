# QA Guide — Browser Testing

End-to-end browser tests for the seeded fixture set, plus the magic-link login flow for an AI QA agent. Setup is done elsewhere; this document assumes the dev server is already running with `ENABLE_DEV_LOGIN=true` and the database is seeded.

---

## 1. Seeded data reference

What's in the DB after `npm run db:seed`. Use this to know what to look for in the browser.

### Users

| Email             | Display name    | Role                              |
| ----------------- | --------------- | --------------------------------- |
| `alice@test.com`  | Alice Anderson  | Org owner, follows bob + carol    |
| `bob@test.com`    | Bob Brown       | Org admin, follows alice          |
| `carol@test.com`  | Carol Carter    | Org member, follows alice + bob   |

All usernames match the local part of the email — `/alice`, `/bob`, `/carol` are their profile URLs.

### Organization
- **"ZeFer Test Org"** — `/organization/zefer-test-org` (the route is `/organization/[orgId]` and accepts either the cuid or the username)
- Owner: alice · Admins: bob · Members: bob, carol
- 4 of the 10 posts below are org posts (marked in the next table).

### Posts (10 total — 9 published, 1 draft)

Visit each at `/<author-username>/<titleId>`. The author-username is the handle, not display name.

| titleId                  | author username | org? |
| ------------------------ | --------------- | ---- |
| `welcome-to-zefer`       | alice           | ✓    |
| `designing-for-readers`  | alice           | ✓    |
| `the-state-of-blogging`  | bob             |      |
| `comment-as-feature`     | carol           |      |
| `reading-history-ux`     | carol           | ✓    |
| `api-keys-explained`     | alice           |      |
| `why-i-write-here`       | bob             |      |
| `notes-on-notifications` | carol           |      |
| `starting-threads`       | alice           | ✓    |
| `draft-wip`              | bob             |      |

`draft-wip` is the only unpublished post. It does **not** appear in feeds or search; it's visible only to bob at `/manage/posts`.

### Comments (4 total)
- `welcome-to-zefer` — bob's top comment, alice's threaded reply ("Thanks Bob!").
- `designing-for-readers` — carol's top comment ("I love how this focuses on the reader.").
- `the-state-of-blogging` — alice's top comment ("Where do you see this going in five years?").

### Reactions (4 likes)
- `welcome-to-zefer`: 👍 bob, 👍 carol.
- `designing-for-readers`: 👍 alice.
- `reading-history-ux`: 👍 bob.

### Follows
- alice → bob, alice → carol
- bob → alice
- carol → alice, carol → bob

### Bookmarks
Alice has bookmarked 2 posts: `welcome-to-zefer`, `the-state-of-blogging`. Visible at `/readinglist` while signed in as alice.

---

## 2. Login flow

The agent's browser authenticates by POSTing to the dev-login endpoint and navigating to the returned magic-link URL. No real email is sent.

```js
const { url } = await fetch("http://localhost:3000/api/dev-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alice@test.com" }),
}).then((r) => r.json());

await page.goto(url);
// Authenticated as Alice.
```

### One context per user

NextAuth sessions live in cookies. Logging in as a second user in the **same** browser context overwrites the first session. Use a fresh `browser.newContext()` per user, or call `context.clearCookies()` between switches.

```js
// Multi-user setup:
const aliceCtx = await browser.newContext();
const alicePage = await aliceCtx.newPage();
await loginAs(alicePage, "alice@test.com");

const bobCtx = await browser.newContext();
const bobPage = await bobCtx.newPage();
await loginAs(bobPage, "bob@test.com");
```

### Verify the session is real
After `page.goto(url)`, two checks prove the login worked:

```js
// 1. Session cookie set:
const cookies = await aliceCtx.cookies();
const session = cookies.find((c) => c.name.includes("session-token"));
console.assert(session, "no session cookie after login");

// 2. Auth-gated route resolves:
await alicePage.goto("http://localhost:3000/settings/profile");
console.assert(
    alicePage.url().endsWith("/settings/profile"),
    "auth gate did not pass — still on sign-in?",
);
```

### Sign out
```js
await alicePage.goto("http://localhost:3000/api/auth/signout");
// Click "Sign out" if a confirmation page appears.
```

---

## 3. Per-user browser smoke tests

For each user, log in fresh and walk through these checks.

### As alice (`alice@test.com`)
1. **Home feed (`/`)** — see Alice's authored posts; org badge visible on the 4 org posts.
2. **`/alice`** — profile shows 4 authored posts (published + drafts), 2 followings (bob, carol), 2 followers.
3. **`/readinglist`** — 2 bookmarked posts (`welcome-to-zefer`, `the-state-of-blogging`).
4. **`/alice/welcome-to-zefer`** — comment thread shows bob's comment with alice's "Thanks Bob!" nested as a reply.
5. **`/settings/profile`** — name "Alice Anderson", bio "QA seed user — Alice.", image URL contains `seed=alice`. Form fields render without crashing (verifies the `socials is not iterable` fix).

### As bob (`bob@test.com`)
1. **`/bob`** — 3 authored posts (the QA doc expects 3: 2 published + 1 draft `draft-wip`), 1 following (alice), 2 followers, and admin-of-org badge on the `ZeFer Test Org` card on the org page.
2. **`/bob/the-state-of-blogging`** — alice's comment visible ("Where do you see this going in five years?").
3. **`/bob/draft-wip`** — **404 / not found** (draft not visible to anyone, including the author via direct URL). Draft appears in `/manage/posts`.
4. **`/organization/zefer-test-org`** — org page lists posts where `org?` column is ✓ in §1, and shows a members section listing Alice (owner), Bob (admin), Carol (member) with role badges.

### As carol (`carol@test.com`)
1. **`/carol`** — 3 authored posts, 2 followings (alice, bob), 2 followers.
2. **`/carol/comment-as-feature`** — her own post, no comments.
3. **`/carol/reading-history-ux`** — bob's like reaction visible.

### Anonymous (no session)
1. **`/alice`** — visible (profiles are public).
2. **`/settings/profile`** — redirects to `/api/auth/signin` (HTTP 307). The Profile form must not be rendered.
3. **`/readinglist`** — redirects to `/api/auth/signin` (HTTP 307). The "Reading List" heading must not be rendered.

---

## 4. Cross-user interactions

Tests that require two browser contexts at once.

### Reply thread (alice → bob's comment)
1. Log in as alice (context A).
2. Log in as bob (context B).
3. In alice's context, navigate to `/alice/welcome-to-zefer` and post a top-level comment.
4. In bob's context, reload `/alice/welcome-to-zefer`.
5. **Expected:** bob sees alice's new comment.

### Bookmark sync (alice)
1. Log in as alice.
2. Visit any post and click the bookmark icon to toggle it on.
3. Reload the page; bookmark remains on.
4. Visit `/readinglist` — new bookmark appears.

### Org membership visibility
1. As alice, visit `/organization/zefer-test-org`.
2. **Expected:** org page shows a "Members" section with Alice (owner badge), Bob (admin badge), and Carol (member badge). Bob is also listed as admin (so owner and admin can both appear, deduplicated).

---

## 5. Post creation

The post composer lives at `/new`. Auth is gated; anonymous visits redirect to `/api/auth/signin`. After login the user is offered `Tiptap` editor with title, description, body, cover image, tags, and (optionally) an organization selector.

### Required fields (gated by the composer before publish)
- Title (non-blank)
- Description (non-blank)
- Cover image (must be uploaded)
- Body: at least 50 words (the publish button refuses otherwise with an "Insufficient words" toast)
- Tags (the editor accepts any tag; an arbitrary new tag may be added by typing)

### 5.1 Happy-path publish as alice
1. Log in as alice.
2. Navigate to `/new`. The Tiptap editor renders with title and description fields, a cover-image button, a tags input, and a body editor.
3. Set title to `qa-hello-world-<timestamp>`.
4. Set description to `A short description for QA.`
5. Upload a cover image (any local image ≥ a few KB).
6. Type ≥ 50 words in the body editor (e.g., a couple of paragraphs of lorem-style text).
7. Add a tag `qa`.
8. Leave the organization selector as "None" (or pick `ZeFer Test Org`; both are valid).
9. Click **Publish**.
10. **Expected:** redirected to `/alice/qa-hello-world-<timestamp>` (the post page). Title, description, cover image, and body render.

### 5.2 Happy-path publish as bob (no org)
1. Log in as bob (fresh context).
2. Navigate to `/new`.
3. Fill the same fields, set the title to `qa-bob-<timestamp>`.
4. Click **Publish**.
5. **Expected:** redirected to `/bob/qa-bob-<timestamp>`. The new post now appears at the top of `/bob`'s profile feed.

### 5.3 Draft autosave
1. Log in as alice.
2. Navigate to `/new`.
3. Type a title and a couple of paragraphs (don't click Publish).
4. Either wait a moment (the editor autosaves) or click the **Save draft** control.
5. **Expected:** visiting `/manage/posts` shows the in-progress draft with the latest content.

### 5.4 Publish gating (each must show an error and not navigate)
For each of the following, attempt to publish from a fresh `/new` session as alice:
- Missing title → must show "Required Fields" with `title` listed.
- Missing description → must show `description` listed.
- Missing cover image → must show `coverImage` listed.
- Body under 50 words → must show "Insufficient words, need a minimum of 50 words to publish."

### 5.5 Verify the new post in the home feed
After publishing `qa-hello-world-<timestamp>` as alice:
1. As alice, navigate to `/`.
2. **Expected:** the new post is visible (top of the Relevant / Latest columns).

### 5.6 Verify the new post appears in the author's profile
After publishing `qa-bob-<timestamp>` as bob:
1. As bob, navigate to `/bob`.
2. **Expected:** the post count is one higher than before, and the new post appears in the feed.

### 5.7 Anonymous /new redirects
1. In an unauthenticated browser context, navigate to `/new`.
2. **Expected:** redirect to `/api/auth/signin` (HTTP 307). The Tiptap editor must not render.

---

## 6. Profile customization

The profile customization editor lives at `/settings/profile/customization`. Auth is gated; anonymous visits redirect to `/api/auth/signin`. After login the user gets a `ProfileCustomization` editor with preset/layout/sections/colors/background/cards/typography controls, all debounced-saved (≈800ms) to `/api/user/profile-customization` (PATCH). The settings affect how the author appears on `/<username>` for everyone, including anonymous viewers.

### Default state (no prior customization)
A fresh user who has never saved a customization sees the editor pre-filled with:
- `preset: "minimal"`
- `layout.variant: "standard"`, full `sectionOrder`, empty `hiddenSections`
- `backgroundColor`, `backgroundImage`, `cardColor`, `textColor`, `mutedTextColor`, `accentColor`, `backgroundOverlay`, `pageGradient` all `null`
- `cardOpacity: 100`, `cardRadius: "medium"`, `cardShadow: "subtle"`, `borderStyle: "none"`
- `fontFamily: "system"`, `headingSize: "large"`, `textAlign: "center"`, `spacingDensity: "comfortable"`

### 6.1 Anonymous redirect
1. In an unauthenticated browser context, navigate to `/settings/profile/customization`.
2. **Expected:** redirect to `/api/auth/signin` (HTTP 307). The editor must not render. No request to `/api/user/profile-customization` succeeds.

### 6.2 Editor loads with defaults (alice)
1. Log in as alice (fresh context).
2. Navigate to `/settings/profile/customization`.
3. **Expected:** page renders the editor without errors. The Preset select shows `minimal`, Layout variant shows `standard`, all eight section checkboxes are checked (none hidden), background color swatch is white (placeholder), Background Image preview is absent, and the Cards/Typography selects show the defaults listed above. No "Saving..." or "Saved" indicator on first paint.

### 6.3 Change preset and verify live save
1. As alice, open `/settings/profile/customization`.
2. Change the Preset select from `minimal` to `editorial`.
3. Wait ~1s (the editor debounces ≈800ms before PATCHing).
4. **Expected:** the save indicator transitions Saving… → Saved.
5. Reload the page.
6. **Expected:** Preset is still `editorial`. The other defaults are preserved (SectionOrder unchanged, all defaults still in place).

### 6.4 Change background color and verify
1. As alice, open `/settings/profile/customization`.
2. Set the Background color swatch to a specific hex (e.g. `#1f2937`).
3. Wait for the Saved indicator.
4. Reload the page.
5. **Expected:** the Background color swatch still shows `#1f2937` (the saved value, not the white placeholder). All other defaults remain.

### 6.5 View customization on public profile
1. While still logged in as alice, open a **separate anonymous context** (`browser.newContext()`).
2. Navigate to `/alice`.
3. **Expected:** the public profile page renders the customization: the page background reflects the chosen background color (`#1f2937` or whatever was set), and the layout variant (`standard`) is applied. No errors in the network panel; `/api/user/profile-customization` does not need to be hit by anonymous viewers — the customization is fetched server-side at `/<username>` page load.

### 6.6 Reset to defaults
1. As alice, return to `/settings/profile/customization`.
2. Click **Reset to defaults**, confirm the browser `confirm` dialog.
3. **Expected:** a success toast appears; the editor fields snap back to the defaults listed above (Preset `minimal`, Layout `standard`, all sections visible, all colors `null`, Background Image absent).
4. Reload the page.
5. **Expected:** defaults are still in place after reload — the reset was persisted.

### 6.7 Public profile returns to default rendering
1. After the reset in §6.6, reload `/alice` in the anonymous context.
2. **Expected:** the page background and layout revert to the seed/default look (no custom background color applied). No 500s, no console errors.

### 6.8 Background image upload
1. As alice, open `/settings/profile/customization`.
2. Pick any local image file (PNG/JPEG/WebP, a few KB) via the **Choose background** file input.
3. **Expected:** the preview image appears immediately. While uploading, the button label reads "Uploading..." and is disabled. When the upload completes, a success toast appears and the backgroundImage field is set to a `https://res.cloudinary.com/...` URL (or `/covers/...` if the QA bypass is in effect).
4. Wait for the Saved indicator.
5. Reload the page.
6. **Expected:** the preview still shows the image, the URL persists in the Background Image preview, and `/alice` (anonymous context) renders the uploaded image as the page background.

### 6.9 Negative — invalid color is rejected
This step verifies the server-side guard. Optional but recommended:
1. As alice, open `/settings/profile/customization`.
2. Open DevTools → Network and capture a `PATCH /api/user/profile-customization`.
3. With the page idle (no Save indicator spinning), repeat the patch with a body containing `backgroundColor: "not-a-color"`.
4. **Expected:** the API returns HTTP 400 with a JSON error. The existing saved customization is unchanged — the next reload still shows the previously saved hex.

---

## 7. What a passing QA run looks like

A clean run is:
- `npm run db:seed` succeeds, `npm run dev` (with `ENABLE_DEV_LOGIN=true`) boots without errors.
- Each of the 3 users logs in via `/api/dev-login` and lands authenticated.
- All §3 per-user checks pass.
- All §4 cross-user checks pass.
- All §5 post-creation checks pass.
- All §6 profile-customization checks pass.
- No console errors in the browser on the visited routes (Socket.IO connection failures are expected if the standalone Socket.IO server on `ws://localhost:5000` isn't running — they don't block functional correctness).
- No 500s in the server log.

---

## 8. Agent quick-reference

```js
// Minimal helper for Playwright:
async function loginAs(page, email) {
    const res = await page.request.post("http://localhost:3000/api/dev-login", {
        headers: { "content-type": "application/json" },
        data: { email },
    });
    const { url } = await res.json();
    await page.goto(url);
}

// Always run after login:
async function assertLoggedIn(page) {
    const cookies = await page.context().cookies();
    if (!cookies.some((c) => c.name.includes("session-token"))) {
        throw new Error(`login failed for ${page.url()}`);
    }
}

// Read a post's titleId from its current URL:
// /<author>/<titleId> -> "titleId"
// /<author>/<titleId>/edit -> "titleId"
function titleIdFromUrl(url) {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] === "edit" ? parts[parts.length - 2] : parts[parts.length - 1];
}
```

**Seeded emails:** `alice@test.com`, `bob@test.com`, `carol@test.com`.
**Server flag:** `ENABLE_DEV_LOGIN=true` must be set when starting `npm run dev`. Without it, `/api/dev-login` returns 404 and no login is possible.
