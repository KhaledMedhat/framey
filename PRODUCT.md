# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Framey is a general-audience social media app, built in the Instagram mold. The
primary user is someone who wants to share photos and short videos of their life
with the people who follow them, and to browse what the people they follow have
posted. They arrive with media already on their device — camera roll, screenshot,
clip — and expect to get from "I have this photo" to "it is posted" without
leaving the app or thinking about file formats.

Two roles exist inside the same person: the **poster**, who is mid-task and
attentive (choosing media, cropping, adjusting, captioning, tagging), and the
**viewer**, who is browsing casually and scanning. Posting is a focused,
multi-step flow; viewing is not.

Account visibility is per-user (`public` / `private`), so some users are sharing
openly and some only to approved followers. Both are first-class.

## Product Purpose

Framey lets people capture, edit, and publish moments — images and video — and
follow the people whose moments they care about. Success is a poster completing
the capture-to-published flow without dropping out at the editor, and a viewer
finding the feed worth returning to.

The tagline committed in the product is *"Capture the moments that matter."*

## Positioning

Two mechanisms carry Framey's difference, and both are already implemented:

1. **In-browser editing depth.** The crop, ratio, filter, adjustment, and video
   trim/cover work all happens client-side before anything is uploaded —
   canvas for images, ffmpeg.wasm for video. There is no server round-trip to
   see what an edit looks like, and the source file is never handed off before
   the user is satisfied with it.
2. **Multi-media storytelling as the post unit.** A post is a carousel that can
   mix images and video, each with its own ratio, cover frame, alt text, and
   per-media people tags, plus post-level collaborators. The composite post, not
   the single image, is the atom.

Design work should treat the editor as a headline surface, not a utility screen.

## Operating Context

The core flow, as built:

- **Entry** — a split marketing/auth screen (`src/app/page.tsx`) carrying the
  Framey logo, banner, and tagline beside the auth forms.
- **Auth** — register or log in (`login-form.tsx`, `register-form.tsx`) via
  NextAuth with both credentials and OAuth accounts.
- **Onboarding** — an incomplete profile is force-routed to
  `onboarding-form.tsx` (username, gender, date of birth) before the app opens;
  `users.profileComplete` gates this.
- **Profile picture** — cropped through the same image editor, inside a dialog
  that widens from `max-w-2xl` to `60rem` when the editor enters its edit stage.
- **Editing** — `image-editor.tsx` and `video-editor.tsx` run a two-stage flow:
  **crop** (ratio, pan, zoom) then **edit** (filters, adjustments; for video,
  trim, mute, cover frame). The edit stage slides in an 18rem (`w-72`) sidebar.
- **Posting** — a post carries caption, location, people tags, collaborators,
  and ordered media; comments and post-info can be hidden per post.
- **Social** — follows, likes, and threaded comments (replies via
  `postComments.parentId`).

## Capabilities and Constraints

Confirmed and implemented:

- Next.js 16 (App Router, React 19, React Compiler) — note this Next.js version
  diverges from common training data; consult `node_modules/next/dist/docs/`.
- Tailwind CSS v4 with a shadcn-based component layer in `src/components/ui`.
- Drizzle ORM against Neon serverless Postgres; all tables prefixed `framey_`.
- NextAuth v5 (beta) with the Drizzle adapter; credentials + OAuth accounts.
- Client-side media pipeline: canvas for images, `@ffmpeg/ffmpeg` (wasm) for
  video trim/cover/compress. `embla-carousel-react` drives multi-media views.
- Forms are `react-hook-form` + `zod` (`src/lib/validations.ts`), with
  `useWatch` rather than `form.watch()` because the React Compiler memoizes
  render-time `watch()` calls.
- Data model supports: posts, ordered post media, per-media tags and covers,
  post collaborators, likes, threaded comments, follows, and per-user
  `public`/`private` visibility.

Undecided / not yet built — do not assume these exist:

- There is no feed, profile page, explore, search, notifications, messaging, or
  post-composer route yet. `src/app` currently holds only the auth entry page
  and the NextAuth route handler.
- No media storage/CDN provider is wired; `ProfilePicture` and `PostMediaFile`
  carry a `key` field that anticipates one, but the upload target is unchosen.
- Follow-request approval for private accounts is modeled only as visibility;
  the request/approval flow itself is not built.
- No monetization, ads, or algorithmic ranking decision has been made.

## Brand Commitments

Binding, per the user:

- **Name and wordmark:** Framey. Assets in `public/`: `framey.png`,
  `framey_white.png`, `framey_transparent.jpg`, `framey_banner.png`,
  `favicon.ico`. Gendered avatar placeholders exist at
  `public/male_vector_placeholder.jpg` and `female_vector_placeholder.jpg`.
- **Tagline:** "Capture the moments that matter."
- **Dark by default.** The root `<html>` carries `dark`; dark is the product's
  default appearance, not a user preference toggled on.
- **The shadcn + Tailwind v4 token system is the design system.** Tokens live in
  `src/app/globals.css` (`oklch` values, `--radius` scale, `@theme inline`
  mapping); primitives live in `src/components/ui`. New work extends this
  system rather than replacing it.
- Type is Inter via `--font-sans`, with Geist Sans/Mono variables also declared.

Not yet confirmed: a brand color. The current palette is a neutral grayscale
shadcn default — no hue has been chosen as Framey's own.

## Evidence on Hand

- Real, working implementations of the image and video editors, auth, and
  onboarding — these are the strongest evidence of the product's intent.
- Real brand assets listed above.
- The schema in `src/server/db/schema.ts` is the authoritative product model.
- **No** users, testimonials, metrics, press, case studies, pricing, or launch
  date exist. Future work must not fabricate any of these, and must not put
  social proof ("trusted by N creators") on any surface.
- `src/app/layout.tsx` still carries the create-next-app default metadata title
  and description; this is a known gap, not a decision.

## Product Principles

1. **The media is the product.** Chrome recedes; photos and video get the pixels,
   the contrast, and the uninterrupted rectangle.
2. **The editor is a destination, not a dialog.** Posting is the moment users
   judge Framey on; it earns real craft, real stage stability, and real
   feedback.
3. **Nothing moves under the user's hands.** In edit flows, the frame the user
   composed stays exactly where and how big it was. Panels arrive beside the
   work, never by resizing it.
4. **Private by choice, and the choice is visible.** A user must always be able
   to tell which audience a post is going to.
5. **Instagram-familiar, not Instagram-copied.** Honor the conventions users
   already carry (carousel posts, tap-to-like, crop-then-filter) and spend the
   originality on the editor and on the details.

## Accessibility & Inclusion

No product-specific standard has been set by the user. Baseline obligations
still apply: the dark default must hold real contrast rather than relying on
dimmed grays, `alt` is already modeled per media (`postMedia.alt`) and should be
collected rather than left empty, and the editor's pointer-driven pan/zoom needs
a keyboard-reachable equivalent since it is currently pointer-only.
