# QA Guide — Browser Testing

End-to-end browser tests for the seeded fixture set, plus the magic-link login flow for an AI QA agent. Setup is done elsewhere; this document assumes the dev server is already running with `ENABLE_DEV_LOGIN=true` and the database is seeded.

---

## 1. Seeded data reference

What's in the DB after `npm run db:seed`. Use this to know what to look for in the browser.

Re-running the QA seed resets posts, organizations, and related fixture activity owned by the three dedicated seeded QA accounts before recreating the standard fixtures.

### Users

| Email             | Display name    | Role                              |
| ----------------- | --------------- | --------------------------------- |
| `alice@test.com`  | Alice Anderson  | Org owner, follows bob + carol    |
| `bob@test.com`    | Bob Brown       | Org admin, follows alice          |
| `carol@test.com`  | Carol Carter    | Org member, follows alice + bob   |

All usernames match the local part of the email — `/alice`, `/bob`, `/carol` are their profile URLs.

### Organization
- **"Weaseln Test Org"** — `/organization/weaseln-test-org` (the route is `/organization/[orgId]` and accepts either the cuid or the username)
- Owner: alice · Admins: bob · Members: bob, carol
- 4 of the 10 posts below are org posts (marked in the next table).

### Posts (10 total — 9 published, 1 draft)

Visit each at `/<author-username>/<titleId>`. The author-username is the handle, not display name.

| titleId                  | author username | org? |
| ------------------------ | --------------- | ---- |
| `welcome-to-weaseln`     | alice           | ✓    |
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

Two of the ten posts carry a visual customization (§6). The other eight are deliberately left at their schema defaults, so any feed shows customized and uncustomized posts side by side:

| titleId | backgroundColor | backgroundPattern | backgroundImage | backgroundFit |
| --- | --- | --- | --- | --- |
| `designing-for-readers` | `moss` | `dots` | — | `cover` |
| `the-state-of-blogging` | `dusk` | `none` | `/covers/cover-2.svg` | `cover` |

`the-state-of-blogging` keeps its own cover image (`/covers/cover-3.svg`): the cover `<figure>` and the surface background are different pictures on purpose, so a QA run can tell the two fields apart.

### Comments (4 total)
- `welcome-to-weaseln` — bob's top comment, alice's threaded reply ("Thanks Bob!").
- `designing-for-readers` — carol's top comment ("I love how this focuses on the reader.").
- `the-state-of-blogging` — alice's top comment ("Where do you see this going in five years?").

### Reactions (4 likes)
- `welcome-to-weaseln`: 👍 bob, 👍 carol.
- `designing-for-readers`: 👍 alice.
- `reading-history-ux`: 👍 bob.

### Follows
- alice → bob, alice → carol
- bob → alice
- carol → alice, carol → bob

### Bookmarks
Alice has bookmarked 2 posts: `welcome-to-weaseln`, `the-state-of-blogging`. Visible at `/readinglist` while signed in as alice.

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

### Where the anonymous bounce lands

`src/auth.ts` sets `pages.signIn = "/login"`, so a gated route costs two hops while preserving the protected destination:

1. `GET /settings/profile` (anonymous) → **307** → `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile` — from the page-level `redirect()` guard, not from `proxy.ts`.
2. `GET /api/auth/signin?callbackUrl=%2Fsettings%2Fprofile` → **302** → `/login?callbackUrl=<same-origin /settings/profile URL>` → 200, the branded page in `src/app/login`.

Following redirects, an anonymous `page.goto()` therefore finishes on `/login?...`, **not** on `/api/auth/signin`. Assert the 307 with redirects disabled, or assert that the final URL starts with `/login`.

Each static page guard supplies its canonical path through `signInUrl()`. Auth.js validates it, stores the resulting same-origin URL for the provider flow, and forwards it to `/login`, so returning readers are sent back to the canonical page they requested. A first-time account still follows `pages.newUser` to `/settings/profile` for onboarding.

| Protected route | First 307 `Location` |
| --- | --- |
| `/new` | `/api/auth/signin?callbackUrl=%2Fnew` |
| `/readinglist` | `/api/auth/signin?callbackUrl=%2Freadinglist` |
| `/manage/posts` | `/api/auth/signin?callbackUrl=%2Fmanage%2Fposts` |
| `/manage/series` | `/api/auth/signin?callbackUrl=%2Fmanage%2Fseries` |
| `/manage/following` | `/api/auth/signin?callbackUrl=%2Fmanage%2Ffollowing` |
| `/manage/organization` | `/api/auth/signin?callbackUrl=%2Fmanage%2Forganization` |
| `/settings/profile` | `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile` |
| `/settings/profile/customization` | `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile%2Fcustomization` |

The magic-link form on `/login` parks the reader at `/login/verify` (`pages.verifyRequest`). The `/api/dev-login` recipe above touches neither page: it goes straight to `/api/auth/callback/nodemailer`, so the callback-preserving guards do not change that shortcut.

---

## 3. Per-user browser smoke tests

For each user, log in fresh and walk through these checks.

### As alice (`alice@test.com`)
1. **Home feed (`/`)** — see Alice's authored posts; org badge visible on the 4 org posts.
2. **`/alice`** — profile shows 4 authored posts (published + drafts), 2 followings (bob, carol), 2 followers.
3. **`/readinglist`** — 2 bookmarked posts (`welcome-to-weaseln`, `the-state-of-blogging`).
4. **`/alice/welcome-to-weaseln`** — comment thread shows bob's comment with alice's "Thanks Bob!" nested as a reply.
5. **`/settings/profile`** — name "Alice Anderson", bio "QA seed user — Alice.", image URL contains `seed=alice`. Form fields render without crashing (verifies the `socials is not iterable` fix).

### As bob (`bob@test.com`)
1. **`/bob`** — 3 authored posts (the QA doc expects 3: 2 published + 1 draft `draft-wip`), 1 following (alice), 2 followers, and admin-of-org badge on the `Weaseln Test Org` card on the org page.
2. **`/bob/the-state-of-blogging`** — alice's comment visible ("Where do you see this going in five years?").
3. **`/bob/draft-wip`** — **404 / not found** (draft not visible to anyone, including the author via direct URL). Draft appears in `/manage/posts`.
4. **`/organization/weaseln-test-org`** — org page lists posts where `org?` column is ✓ in §1, and shows a members section listing Alice (owner), Bob (admin), Carol (member) with role badges.

### As carol (`carol@test.com`)
1. **`/carol`** — 3 authored posts, 2 followings (alice, bob), 2 followers.
2. **`/carol/comment-as-feature`** — her own post, no comments.
3. **`/carol/reading-history-ux`** — bob's like reaction visible.

### Anonymous (no session)
1. **`/alice`** — visible (profiles are public).
2. **`/settings/profile`** — redirects to `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile` (HTTP 307, then **302** → `/login`). The Profile form must not be rendered; a returning-user sign-in returns to `/settings/profile`.
3. **`/readinglist`** — redirects to `/api/auth/signin?callbackUrl=%2Freadinglist` (HTTP 307, then **302** → `/login`). The "Reading List" heading must not be rendered; a returning-user sign-in returns to `/readinglist`.

---

## 4. Cross-user interactions

Tests that require two browser contexts at once.

### Reply thread (alice → bob's comment)
1. Log in as alice (context A).
2. Log in as bob (context B).
3. In alice's context, navigate to `/alice/welcome-to-weaseln` and post a top-level comment.
4. In bob's context, reload `/alice/welcome-to-weaseln`.
5. **Expected:** bob sees alice's new comment.

### Bookmark sync (alice)
1. Log in as alice.
2. Visit any post and click the bookmark icon to toggle it on.
3. Reload the page; bookmark remains on.
4. Visit `/readinglist` — new bookmark appears.

### Org membership visibility
1. As alice, visit `/organization/weaseln-test-org`.
2. **Expected:** org page shows a "Members" section with Alice (owner badge), Bob (admin badge), and Carol (member badge). Bob is also listed as admin (so owner and admin can both appear, deduplicated).

---

## 5. Post creation

The post composer lives at `/new`. Auth is gated; anonymous visits redirect to `/api/auth/signin?callbackUrl=%2Fnew` (then **302** → `/login`; see §2), and a returning-user sign-in returns to `/new`. The user is then offered the `Tiptap` editor with title, description, body, cover image, tags, and (optionally) an organization selector.

### Required fields (gated by the composer before publish)
- Title (non-blank)
- Description (non-blank)
- Body: at least 50 words (the publish button refuses otherwise with an "Insufficient words" toast)
- Tags (the editor accepts any tag; an arbitrary new tag may be added by typing)

### Optional fields
- **Cover image** — the composer uploads it to Cloudinary and stores the resulting URL on `Post.coverImage`. The field is **nullable** in the schema; publishing without one is allowed. When a post has no cover, the feed card (`PostContainer` / `PostCard`) and the post page (`/[userId]/[slug]`) skip the cover `<figure>` entirely — no placeholder, no watermark.

### 5.1 Happy-path publish as alice
1. Log in as alice.
2. Navigate to `/new`. The Tiptap editor renders with title and description fields, a cover-image button, a tags input, and a body editor.
3. Set title to `qa-hello-world-<timestamp>`.
4. Set description to `A short description for QA.`
5. Upload a cover image (any local image ≥ a few KB) — or skip; cover is optional.
6. Type ≥ 50 words in the body editor (e.g., a couple of paragraphs of lorem-style text).
7. Add a tag `qa`.
8. Leave the organization selector as "None" (or pick `Weaseln Test Org`; both are valid).
9. Click **Publish**.
10. **Expected:** redirected to `/alice/qa-hello-world-<timestamp>` (the post page). Title, description, body, and (if uploaded) cover image render.

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
- Body under 50 words → must show "Insufficient words, need a minimum of 50 words to publish."

Cover image is NOT in the gating list — it is optional. Publishing without a cover must succeed (covered by §5.1a).

### 5.1a Happy-path publish without a cover image
1. Log in as alice.
2. Navigate to `/new`.
3. Set title to `qa-nocover-<timestamp>`.
4. Set description to `A no-cover QA post.`
5. Skip the cover upload (cover is optional).
6. Type ≥ 50 words in the body editor.
7. Add a tag `qa`.
8. Click **Publish**.
9. **Expected:** redirected to `/alice/qa-nocover-<timestamp>`. The post page renders title, description, and body — the cover `<figure>` is **not** rendered (no placeholder, no watermark). The feed card on `/` and `/alice` likewise omits the cover region.

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
2. **Expected:** redirect to `/api/auth/signin?callbackUrl=%2Fnew` (HTTP 307, then **302** → `/login`). The Tiptap editor must not render; a returning-user sign-in returns to `/new`.

---

## 6. Post customization

An author can give a post a background colour, a texture pattern and a background image from the composer at `/new`, and change them later from `/<author>/<titleId>/edit`. The four values persist as scalar columns on `Post` — `backgroundColor`, `backgroundPattern`, `backgroundImage`, `backgroundFit` — and on the same four columns of `PostDraft`, so a background picked mid-compose survives autosave.

`backgroundColor` stores a **palette slug** (`default`, `clay`, `apricot`, `sand`, `moss`, `fern`, `fog`, `slate`, `dusk`, `blossom`), never a CSS colour: the stylesheet supplies a light/dark pair per slug, so a customized post has to stay readable across a theme flip. `backgroundImage` accepts only `/covers/…` or `https://res.cloudinary.com/…`.

### Where the controls are

The composer action bar carries a **Background** button (its dot shows the current swatch) that opens a **Post background** dialog. The dialog holds a live sample plus up to four radio groups, each one tab stop with arrow keys moving the selection:

| Group | Options |
| --- | --- |
| **Background colour** | `Default`, `Clay`, `Apricot`, `Sand`, `Moss`, `Fern`, `Fog`, `Slate`, `Dusk`, `Blossom` |
| **Texture** | `None`, `Dots`, `Grid`, `Hatch`, `Wash` |
| **Background image** | `Remove image`, `Cover 1`–`Cover 4` |
| **Image fit** | `Fill`, `Tile` — shown only while an image is set |

**Done** closes the dialog. Nothing here is a separate save: the choice rides along with the publish (or the autosave) as a `customization` field.

### How to assert it in the browser

All three render surfaces — the feed card, the feed container and the post page — spread the output of a single function, so a customization shows up in the DOM as data attributes and nothing else:

| Stored value | Rendered as |
| --- | --- |
| `backgroundColor: "moss"` | `data-post-bg="moss"` on the card / article surface |
| `backgroundPattern: "dots"` | `data-post-pattern="dots"` |
| `backgroundImage: "/covers/cover-2.svg"` | `data-post-fit="cover"` plus an inline `--post-image` custom property holding `url("/covers/cover-2.svg")` |
| everything at its default | **no** `data-post-*` attribute and no inline style at all |

A background image beats a pattern (both drive `background-image`), so a post with an image renders `data-post-fit` and no `data-post-pattern`.

### 6.1 Seeded baseline — customized and uncustomized in one feed
1. Log in as alice.
2. Navigate to `/` (check the Relevant and Latest columns; both posts are published, and alice follows bob).
3. **Expected:** the `designing-for-readers` card carries `data-post-bg="moss"` and `data-post-pattern="dots"`; the `the-state-of-blogging` card carries `data-post-bg="dusk"`, `data-post-fit="cover"` and the `--post-image` property. Every other card in the same feed carries **no** `data-post-*` attribute.
4. Flip the theme (light ↔ dark).
5. **Expected:** both customized cards keep legible title, body and metadata text. The tint changes with the theme; ink is never left dark-on-dark or light-on-light.

### 6.2 Pick a background colour in the composer
1. Log in as alice.
2. Navigate to `/new` and fill the required fields from §5 — title `qa-bg-<timestamp>`, a description, ≥ 50 words of body, a tag.
3. Click **Background**, and in the **Background colour** group choose **Clay**. Select it by its accessible name, not by pixel position.
4. **Expected:** the live sample at the top of the dialog takes the clay tint immediately, and the dot on the **Background** button matches it.
5. Tab to the **Background colour** group and press → / ←.
6. **Expected:** the group is a single tab stop and the arrow keys move the selection through the swatches, wrapping at both ends. Leave **Clay** selected and click **Done**.
7. Click **Publish**.
8. **Expected:** redirected to `/alice/qa-bg-<timestamp>`, and the article surface there carries `data-post-bg="clay"`.

### 6.3 Pick a bundled background image
1. As alice, open `/new` and fill the required fields; title `qa-bgimg-<timestamp>`.
2. Click **Background**, pick a **Texture** (say **Dots**), then in the **Background image** group choose **Cover 2**. The four bundled covers are served from `public/covers/`, so no Cloudinary credentials are needed.
3. **Expected:** the live sample shows the image, the **Texture** group's hint changes to say it is hidden while an image is set, and an **Image fit** group appears with **Fill** selected.
4. Choose **Remove image**.
5. **Expected:** the **Image fit** group disappears and the **Dots** texture renders in the sample again — clearing the image falls back to the texture rather than to nothing.
6. Choose **Cover 2** again, then click **Done**.
7. Click **Publish**.
8. **Expected:** the post page surface carries `data-post-fit="cover"` (the `Fill` option) and an inline `--post-image` of `url("/covers/cover-2.svg")`, and **no** `data-post-pattern` — the image beat the texture. The post's own cover `<figure>` (§5) is untouched: cover image and background image are separate fields.

### 6.4 The same styling on the feed card and the post page
1. After §6.2 and §6.3, as alice navigate to `/`.
2. **Expected:** the cards for `qa-bg-<timestamp>` and `qa-bgimg-<timestamp>` carry exactly the `data-post-*` values their post pages carry.
3. Navigate to `/alice`.
4. **Expected:** the same values again on the profile feed cards.
5. Open both post pages and compare.
6. **Expected:** identical on all three surfaces. A divergence is a bug: the card, the container and the post page all read the same function, so there is no second implementation to disagree with.
7. Repeat step 2 in an anonymous context.
8. **Expected:** signed-out readers see the same customization — it is resolved server-side, not from the session.

### 6.5 An uncustomized post is unchanged
1. As alice, publish a post without touching the background controls (§5.1 is enough), or pick any seeded post other than the two listed in §1.
2. **Expected:** its feed card and post page carry no `data-post-bg`, no `data-post-pattern`, no `data-post-fit` and no inline `--post-image`; the surface keeps the normal card background.
3. **Expected:** it sits in the same feed as the customized posts from §6.1 with no visual change of its own — no faint tint, no extra border, no spacing shift.

### 6.6 The choice survives a draft save
1. As alice, open `/new`.
2. Enter a title and a paragraph, then open **Background** and choose the **Fern** swatch and the **Grid** texture. Do not publish.
3. Wait for the autosave, or click **Save draft** (§5.3).
4. Open `/manage/posts` and reopen the draft.
5. **Expected:** the **Background** button shows the fern dot, and inside the dialog **Fern** and **Grid** are still the checked radios — `PostDraft` carries the same four columns as a published post.
6. Publish the draft.
7. **Expected:** the published post renders `data-post-bg="fern"` and `data-post-pattern="grid"`. Nothing is lost in the draft → post hand-off.

### 6.7 The choice survives an edit
1. As alice, open `/alice/qa-bg-<timestamp>/edit`.
2. **Expected:** the **Background** button already shows the clay dot, and the dialog opens with **Clay** checked — not reset to **Default**.
3. Change the swatch to **Blossom**, set the texture to **Hatch**, and save.
4. **Expected:** the post page now renders `data-post-bg="blossom"` and `data-post-pattern="hatch"`, and so do its cards on `/` and `/alice`. No trace of `clay` remains on any surface.
5. Edit once more: set the colour back to **Default**, the texture to **None**, choose **Remove image**, and save.
6. **Expected:** the post drops every `data-post-*` attribute and returns to the plain appearance of §6.5. Clearing a customization has to be possible, not one-way.

### 6.8 Negative — an unsupported value is rejected
This step checks the server-side guard. Optional but recommended:
1. As alice, open DevTools → Network and capture the composer's `POST /api/post` (or the draft save to `/api/post/draft`). The choice travels as a `customization` FormData field holding JSON.
2. Replay the request with that field set to `{"backgroundColor":"#ff0000"}` — a CSS colour instead of a slug. Repeat with `{"backgroundImage":"https://evil.example.com/x.png"}`, and again with a field that is not JSON at all.
3. **Expected:** HTTP 400 with a JSON error every time, and no row written or changed. Writes validate strictly and refuse; an unsupported value is never quietly sanitised into a valid one.
4. Reload the post.
5. **Expected:** the previously saved customization is intact.

---

## 7. Profile customization

The profile customization editor lives at `/settings/profile/customization`. Auth is gated; anonymous visits redirect to `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile%2Fcustomization` (then **302** → `/login`; see §2), and a returning-user sign-in returns to the editor. The user gets preset/layout/sections/colors/background/cards/typography controls, all debounced-saved (≈800ms) to `/api/user/profile-customization` (PATCH). The settings affect how the author appears on `/<username>` for everyone, including anonymous viewers.

### Default state (no prior customization)
A fresh user who has never saved a customization sees the editor pre-filled with:
- `preset: "minimal"`
- `layout.variant: "standard"`, full `sectionOrder`, empty `hiddenSections`
- `backgroundColor`, `backgroundImage`, `cardColor`, `textColor`, `mutedTextColor`, `accentColor`, `backgroundOverlay`, `pageGradient` all `null`
- `cardOpacity: 100`, `cardRadius: "medium"`, `cardShadow: "subtle"`, `borderStyle: "none"`
- `fontFamily: "system"`, `headingSize: "large"`, `textAlign: "center"`, `spacingDensity: "comfortable"`

### 7.1 Anonymous redirect
1. In an unauthenticated browser context, navigate to `/settings/profile/customization`.
2. **Expected:** redirect to `/api/auth/signin?callbackUrl=%2Fsettings%2Fprofile%2Fcustomization` (HTTP 307, then **302** → `/login`). The editor must not render. No request to `/api/user/profile-customization` succeeds; a returning-user sign-in returns to `/settings/profile/customization`.

### 7.2 Editor loads with defaults (alice)
1. Log in as alice (fresh context).
2. Navigate to `/settings/profile/customization`.
3. **Expected:** page renders the editor without errors. The Preset select shows `minimal`, Layout variant shows `standard`, all eight section checkboxes are checked (none hidden), background color swatch is white (placeholder), Background Image preview is absent, and the Cards/Typography selects show the defaults listed above. No "Saving..." or "Saved" indicator on first paint.

### 7.3 Change preset and verify live save
1. As alice, open `/settings/profile/customization`.
2. Change the Preset select from `minimal` to `editorial`.
3. Wait ~1s (the editor debounces ≈800ms before PATCHing).
4. **Expected:** the save indicator transitions Saving… → Saved.
5. Reload the page.
6. **Expected:** Preset is still `editorial`. The other defaults are preserved (SectionOrder unchanged, all defaults still in place).

### 7.4 Change background color and verify
1. As alice, open `/settings/profile/customization`.
2. Set the Background color swatch to a specific hex (e.g. `#1f2937`).
3. Wait for the Saved indicator.
4. Reload the page.
5. **Expected:** the Background color swatch still shows `#1f2937` (the saved value, not the white placeholder). All other defaults remain.

### 7.5 View customization on public profile
1. While still logged in as alice, open a **separate anonymous context** (`browser.newContext()`).
2. Navigate to `/alice`.
3. **Expected:** the public profile page renders the customization: the page background reflects the chosen background color (`#1f2937` or whatever was set), and the layout variant (`standard`) is applied. No errors in the network panel; `/api/user/profile-customization` does not need to be hit by anonymous viewers — the customization is fetched server-side at `/<username>` page load.

### 7.6 Reset to defaults
1. As alice, return to `/settings/profile/customization`.
2. Click **Reset to defaults**, confirm the browser `confirm` dialog.
3. **Expected:** a success toast appears; the editor fields snap back to the defaults listed above (Preset `minimal`, Layout `standard`, all sections visible, all colors `null`, Background Image absent).
4. Reload the page.
5. **Expected:** defaults are still in place after reload — the reset was persisted.

### 7.7 Public profile returns to default rendering
1. After the reset in §7.6, reload `/alice` in the anonymous context.
2. **Expected:** the page background and layout revert to the seed/default look (no custom background color applied). No 500s, no console errors.

### 7.8 Background image upload
1. As alice, open `/settings/profile/customization`.
2. Pick any local image file (PNG/JPEG/WebP, a few KB) via the **Choose background** file input.
3. **Expected:** the preview image appears immediately. While uploading, the button label reads "Uploading..." and is disabled. When the upload completes, a success toast appears and the backgroundImage field is set to a `https://res.cloudinary.com/...` URL (or `/covers/...` if the QA bypass is in effect).
4. Wait for the Saved indicator.
5. Reload the page.
6. **Expected:** the preview still shows the image, the URL persists in the Background Image preview, and `/alice` (anonymous context) renders the uploaded image as the page background.

### 7.9 Negative — invalid color is rejected
This step verifies the server-side guard. Optional but recommended:
1. As alice, open `/settings/profile/customization`.
2. Open DevTools → Network and capture a `PATCH /api/user/profile-customization`.
3. With the page idle (no Save indicator spinning), repeat the patch with a body containing `backgroundColor: "not-a-color"`.
4. **Expected:** the API returns HTTP 400 with a JSON error. The existing saved customization is unchanged — the next reload still shows the previously saved hex.

---

## 8. What a passing QA run looks like

A clean run is:
- `npm run db:seed` succeeds, `npm run dev` (with `ENABLE_DEV_LOGIN=true`) boots without errors.
- Each of the 3 users logs in via `/api/dev-login` and lands authenticated.
- All §3 per-user checks pass.
- All §4 cross-user checks pass.
- All §5 post-creation checks pass.
- All §6 post-customization checks pass.
- All §7 profile-customization checks pass.
- No console errors in the browser on the visited routes (Socket.IO connection failures are expected if the standalone Socket.IO server on `ws://localhost:5000` isn't running — they don't block functional correctness).
- No 500s in the server log.

---

## 9. Agent quick-reference

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
