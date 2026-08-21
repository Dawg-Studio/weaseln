# weaseln creative profile customization — design

**Status:** approved for specification (brainstorming, 2026-08-18)
**Scope:** curated, responsive customization for public user profiles.

## Goal

Turn the currently plain user profile into a personal creative space. Users can customize the profile's visual identity and the arrangement of supported profile sections without writing CSS or building an arbitrary page.

The first version is a curated builder: it offers rich visual controls and safe layout choices, while the application remains responsible for responsive behavior, accessibility, and rendering valid profile content.

## Decisions

- Use one one-to-one `UserProfileCustomization` row per user.
- Reuse the existing Cloudinary upload flow for background images.
- Save changes live through a dedicated API endpoint.
- Use one responsive configuration; do not store separate mobile layouts.
- Support automatic responsive behavior through predefined layout variants.
- Support existing profile content plus featured posts, interests, and organizations.
- Do not accept arbitrary CSS, HTML, or JavaScript.
- Remove `User.profileTheme` and `User.backgroundImage` after migrating their values.

## Alternatives considered

### One customization row with typed fields and layout JSON — selected

Common visual properties remain simple columns. Section order, hidden sections, and the layout variant live in one validated JSON object. This keeps the model queryable and migration-friendly without creating separate tables for every presentation property.

### Fully normalized customization tables

This would support reusable themes and many saved designs, but adds tables and relationships that the current requirement does not need.

### One unvalidated JSON blob

This is the smallest schema change but weakens validation, migrations, and failure handling. It also mixes unrelated concerns in one opaque value.

## Data model

Add the following relation to `User`:

```prisma
profileCustomization UserProfileCustomization?
```

Add a model in the `users` schema:

```prisma
model UserProfileCustomization {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  preset             String @default("minimal")
  layout             Json
  backgroundColor    String?
  backgroundImage    String?
  backgroundSize     String @default("cover")
  backgroundPosition String @default("center")
  backgroundOverlay  String?
  pageGradient       String?
  cardColor          String?
  cardOpacity        Int    @default(100)
  cardRadius         String @default("medium")
  cardShadow         String @default("subtle")
  borderStyle        String @default("none")
  textColor          String?
  mutedTextColor     String?
  accentColor        String?
  fontFamily         String @default("system")
  headingSize        String @default("large")
  textAlign          String @default("center")
  spacingDensity     String @default("comfortable")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@schema("users")
}
```

`layout` is validated as:

```ts
type ProfileSection =
  | "hero"
  | "stats"
  | "about"
  | "socials"
  | "featuredPost"
  | "interests"
  | "organizations"
  | "posts";

type ProfileLayout = {
  variant: "standard" | "sidebar" | "wide";
  sectionOrder: ProfileSection[];
  hiddenSections: ProfileSection[];
};
```

The allowed values for all string style fields are application-owned enums or curated tokens. Color fields may contain validated hex/rgb/hsl values; they are not arbitrary CSS declarations.

## Settings experience

Add a dedicated customization area at `/settings/profile/customization`, linked from the existing profile settings page.

Controls are grouped into:

1. **Preset and layout** — preset selection and standard/sidebar/wide layout variants.
2. **Sections** — visibility toggles and up/down ordering for hero, stats, about, socials, featured post, interests, organizations, and posts.
3. **Colors and gradients** — page background, gradient, card, text, muted text, and accent colors.
4. **Background image** — upload through Cloudinary, position, size, overlay, and remove/reset actions.
5. **Cards and surfaces** — opacity, radius, shadow, border style, and spacing density.
6. **Typography** — curated font family, heading size, and text alignment.

Use native controls where practical, including color inputs, selects, checkboxes/toggles, and buttons for ordering. The editor must expose accessible labels and visible state. A reset-to-default action restores the minimal configuration.

## API and data flow

Add an authenticated handler:

```text
PATCH /api/user/profile-customization
```

The handler:

1. Calls `await auth()` and rejects requests without `session?.user`.
2. Validates the request against the allowed customization shape.
3. Verifies the request user owns the target record; the endpoint accepts no arbitrary user ID.
4. Upserts the one-to-one customization row.
5. Returns the saved configuration.

The settings client sends only changed or complete validated settings, updates its local state after success, and displays the existing toast pattern. Errors are returned explicitly and do not silently fall back to fabricated values.

Background uploads continue through the existing Cloudinary endpoint. The customization record stores the resulting URL and no binary data.

## Public profile rendering

The profile page loads the user's customization together with the user record and passes it into `UserOrgProfile`. The renderer maps validated settings to known CSS variables and known Tailwind/DaisyUI classes.

Rendering rules:

- Missing customization uses the default minimal configuration.
- Malformed persisted customization is treated as invalid data and renders the safe default while logging the failure for diagnosis.
- Background images are applied only as image URLs.
- Radius, shadow, border, typography, alignment, and spacing values map to known classes/tokens.
- Hidden sections are omitted and `sectionOrder` controls the remaining supported sections.
- Unsupported or duplicate sections are rejected by validation.
- The existing organization profile path remains separate and is not affected by user customization.
- Responsive behavior is built into each layout variant; no per-device configuration is stored.

The profile must preserve the current public content and accessibility behavior, including named links, meaningful image alt text, keyboard-accessible controls, and readable contrast.

## Migration

Create a Prisma migration that:

1. Adds `UserProfileCustomization`.
2. Creates a default row for every existing user.
3. Copies `User.backgroundImage` into `backgroundImage`.
4. Maps `User.profileTheme` into `preset` only when it matches a supported preset; otherwise uses `minimal`.
5. Initializes `layout` with the standard section order and no hidden sections.
6. Removes `profileTheme` and `backgroundImage` from `User`.

Existing profiles therefore retain their background image where possible and otherwise remain visually safe and minimal.

## Validation and safety

- Only the authenticated owner can change customization.
- Reject unknown fields and unsupported enum values.
- Validate colors and limit their length.
- Accept background URLs only from Cloudinary or approved local paths.
- Limit image URL length.
- Limit layout array size and reject duplicates or unknown sections.
- Clamp `cardOpacity` to the supported range.
- Never inject arbitrary CSS, HTML, or JavaScript.
- Keep the renderer resilient to malformed legacy/database data.

## Verification

Add focused coverage for:

- Default customization creation.
- Migration of old theme and background values.
- Valid owner updates.
- Unauthorized updates.
- Invalid colors, URLs, enums, and layout values.
- Section hiding and ordering.
- Preset and style rendering on public profiles.
- Background upload integration.
- Reset-to-default behavior.
- Mobile rendering at the existing QA viewport.

Update `docs/QA.md` with an authenticated customization flow and public-profile checks. Before completion, run:

```bash
npx eslint .
npx tsc --noEmit
```

## Scope exclusions

- Arbitrary drag-and-drop positioning.
- User-authored CSS or HTML.
- Multiple saved themes per user.
- Theme sharing or marketplace features.
- Separate mobile layouts.
- New image storage infrastructure.
