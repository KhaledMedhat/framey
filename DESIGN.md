---
name: Framey
description: A darkroom for a social photo app — achromatic chrome, tonal depth, and the image as the only source of color.
colors:
  ground: "oklch(0.145 0 0)"
  surface: "oklch(0.205 0 0)"
  surface-raised: "oklch(0.269 0 0)"
  ink: "oklch(0.985 0 0)"
  ink-muted: "oklch(0.708 0 0)"
  ink-inverse: "oklch(0.205 0 0)"
  accent-light: "oklch(0.922 0 0)"
  hairline: "oklch(1 0 0 / 10%)"
  hairline-input: "oklch(1 0 0 / 15%)"
  focus-ring: "oklch(0.556 0 0)"
  destructive: "oklch(0.704 0.191 22.216)"
  daylight-ground: "oklch(1 0 0)"
  daylight-ink: "oklch(0.145 0 0)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.375rem"
  md: "0.75rem"
  lg: "1.25rem"
  xl: "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "oklch(0.922 0 0 / 80%)"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-ghost-hover:
    backgroundColor: "oklch(0.269 0 0 / 50%)"
  button-destructive:
    backgroundColor: "oklch(0.704 0.191 22.216 / 20%)"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  button-overlay:
    backgroundColor: "oklch(0.145 0 0 / 80%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "2.25rem"
  input:
    backgroundColor: "oklch(1 0 0 / 3%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
    height: "2.25rem"
    typography: "{typography.body}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  tab-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.5rem"
  tab-trigger-active:
    textColor: "{colors.ink}"
---

# Design System: Framey

## Overview

**Creative North Star: "The Darkroom"**

Framey's interface is a near-black room with the work lit from inside it. The
application shell is achromatic from edge to edge — every color token in the
system is an OKLCH gray with literally zero chroma — so the only saturated thing
on any screen is the photograph or the video the user came to look at. The
chrome is not shy for lack of ideas; it is dark so that a warm skin tone, a green
field, a neon sign in someone's snapshot reads as the loudest thing in the
viewport. Turn the chrome up and you turn the photo down.

Depth is built the way light builds it in a dark room: by lifting a surface, not
by casting a shadow. The ground sits at `oklch(0.145)`, cards and dialogs step up
to `0.205`, the raised interior surfaces to `0.269`, and the boundaries between
them are 10%-white hairlines rather than strokes of solid color. Shadow exists in
the codebase only as a whisper (`shadow-xs`) under inputs and outline buttons.
Nothing in this system floats.

Controls are soft and unobtrusive by intent. They round at 10px, stand 36px tall,
carry thin translucent borders, nudge down exactly one pixel when pressed, and
answer focus with a 3px halo at half opacity. That is the full extent of the
personality on a button; all remaining expressiveness is spent on the media
surfaces — the crop stage, the thirds grid, the filter thumbnails, the pill
overlays that hover on top of a photo without ever framing it.

**Key Characteristics:**

- Achromatic by doctrine: zero-chroma grays everywhere, destructive red the one exception
- Dark-first — the `dark` class is on `<html>`, not on a toggle
- Tonal layering instead of shadow: 0.145 → 0.205 → 0.269
- Hairlines at 10% white, never solid borders
- 36px control height, 10px corner radius, 1px press displacement
- Media meets its surface directly, with no frame, shadow, or decorative edge
- One typeface (Inter) doing display through label work by weight and size alone

## Colors

A single achromatic ramp, plus one red that only ever means danger.

### Primary

- **Bright Paper** (`oklch(0.922 0 0)`): The primary action color — inverted against the dark room, so a filled button reads as a lit rectangle. Carries `Ink Inverse` text. Used for the one committing action on a surface, never twice in the same view.

### Neutral

- **Room Black** (`oklch(0.145 0 0)`): The application ground. Every screen starts here. Also the fill behind the crop stage so a transparent PNG shows honest emptiness.
- **Panel Gray** (`oklch(0.205 0 0)`): Cards, dialogs, popovers, dropdowns, and the editor's tool sidebar — the first step up from the ground.
- **Raised Gray** (`oklch(0.269 0 0)`): Secondary buttons, muted wells, hover fills, and the selected state on filter thumbnails. The highest surface the chrome reaches.
- **Ink** (`oklch(0.985 0 0)`): Primary text and iconography.
- **Muted Ink** (`oklch(0.708 0 0)`): Placeholders, helper text, slider readouts, inactive tab labels, timestamps. Anything that must be legible without being read first.
- **Hairline** (`oklch(1 0 0 / 10%)`): Every divider and container border. It is white at 10%, so it brightens as the surface under it lifts — the border is always a relationship, never a fixed gray.
- **Input Hairline** (`oklch(1 0 0 / 15%)`): Field borders only, one step more present than a divider because a field must advertise that it is enterable.
- **Focus Gray** (`oklch(0.556 0 0)`): The focus ring, rendered at 50% opacity across 3px.

### Tertiary

- **Alarm Red** (`oklch(0.704 0.191 22.216)`): The single chromatic token in the chrome. Destructive actions, invalid fields, and error messages only. It appears as a 20%-opacity wash behind red text, not as a solid fill.

### Named Rules

**The Achromatic Chrome Rule.** Every interface color in Framey has zero chroma. If a new token needs a hue, the answer is no — unless it is communicating danger. The photograph is the only place color lives.

**The One Lit Surface Rule.** `Bright Paper` appears once per view, on the single action that commits. A screen with two filled buttons has no primary action.

**The Relative Border Rule.** Borders are white at 10–15% opacity, never an opaque gray. A hairline must stay correct when the surface beneath it changes level.

## Typography

**Display Font:** Inter (`--font-sans`, with system sans fallback)
**Body Font:** Inter — the same family
**Label/Mono Font:** Geist Mono (`--font-geist-mono`), declared for numeric and technical readouts

**Character:** One neutral grotesque carries the entire system. Hierarchy is made from weight and size, never from a second voice — which is correct for a product where every screen is mostly photograph. Inter's tight apertures hold up at 12px over a dark ground, where a softer face would smear.

### Hierarchy

- **Display** (700, 3rem/48px, line-height 1): The marketing promise on the entry screen — "Capture the moments that matter." Appears once per surface, if at all.
- **Headline** (700, 1.5rem/24px, line-height 1.2): The same promise at mobile width, and section openers.
- **Title** (500, 1rem/16px, line-height 1): Dialog titles and field legends. Medium weight, never bold — a title announces, it does not shout.
- **Body** (400, 0.875rem/14px, line-height 1.5): The system default. All controls, labels, menu items, and running text. Inputs render at 16px on small screens and drop to 14px at `md`, because iOS zooms anything under 16px on focus.
- **Label** (400, 0.75rem/12px): Filter names, slider readouts, helper text, counters. Usually in `Muted Ink`.

### Named Rules

**The Single Voice Rule.** Inter does every job. A second display face is not an upgrade to this system — it is a competing signal against the photo.

**The Sixteen Pixel Rule.** Any text input renders at 16px below the `md` breakpoint. Smaller text in a field makes mobile Safari zoom the viewport and lose the user's place mid-form.

## Layout

The spatial model is a container-and-stage system rather than a page grid.
Marketing and auth surfaces use a two-column split at `lg` (`grid min-h-svh
lg:grid-cols-2`) with a vertical hairline separator down the middle, collapsing
to a single stacked column below it; the content column caps at `max-w-lg`
(32rem) and centers.

Application and editing surfaces use a **fixed stage plus an adjacent panel**.
The media stage holds a square container (`aspect-square`) and the tool sidebar
occupies a fixed 18rem (`w-72`) beside it, animating its width from `0` while its
inner panel slides in from `-100%`. The stage is `flex-1` and the panel is
`shrink-0`, so the panel takes its width from the container rather than from the
stage.

Rhythm runs on Tailwind's 4px base. The recurring steps are 4px (icon-to-label),
6px (button inset), 12px (grid gutters, overlay insets), 20px (slider stacks),
and 28px (form field groups — `FieldGroup` uses `gap-7`). Dialogs pad `px-0` and
rely on their children to inset, so a media surface can run edge to edge inside
one.

Breakpoints are Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280), with
two custom em-based queries on the profile-picture dialog (`max-[50rem]`,
`min-[44rem]`) that govern how it offsets from center as it grows.

### Named Rules

**The Stage Is Fixed Rule.** A panel that opens beside the work must not change the work's size. Grow the container by exactly the panel's width and let the stage keep its own; never let the stage take `w-full` of a container that is about to widen.

**The Edge-to-Edge Media Rule.** Dialogs and cards containing media carry no horizontal padding of their own. Padding is applied by the non-media children.

## Elevation & Depth

Framey layers tonally and does not cast shadows. Depth is read from surface
lightness — `Room Black` (0.145) for ground, `Panel Gray` (0.205) for cards,
dialogs, popovers and the tool sidebar, `Raised Gray` (0.269) for controls and
hover fills sitting on those cards — with a 10%-white hairline marking each
boundary. A raised surface is *lighter*, not *shadowed*, because a dark room
lights things from within.

Two exceptions exist in the code and are deliberate. Inputs and outline buttons
carry `shadow-xs`, a shadow so slight it reads as a seated edge rather than
elevation. The dialog scrim uses `bg-background/10` with
`supports-backdrop-filter:backdrop-blur-xs` — depth by defocus, not by darkening,
so the photo behind a dialog stays visible as context.

Overlay controls that sit directly on top of media are the third case: a pill of
`bg-background/80` with `backdrop-blur-sm` and `shadow-sm`. This is the only
place a shadow carries real work, and only because the surface beneath it is an
unpredictable photograph rather than a known token.

### Shadow Vocabulary

- **Seated edge** (`shadow-xs`): Inputs and outline buttons. Signals enterable, not elevated.
- **Media overlay** (`shadow-sm` + `backdrop-blur-sm` + `bg-background/80`): Controls floating on a photo or video. The blur, not the shadow, does the separating.

### Named Rules

**The Lighter-Not-Darker Rule.** To raise a surface, increase its lightness one step on the ramp. Do not add a shadow. A shadow in this system means "I am on top of media I cannot predict," and nothing else.

**The Scrim Stays Transparent Rule.** Modal backdrops blur at 10% opacity rather than dimming to black. The user must still see the image they were working on.

## Shapes

Corners follow a single `--radius` of 0.625rem (10px) with a multiplier scale:
`sm` at 0.6× (6px), `md` at 0.8× (8px), `lg` at 1× (10px), `xl` at 1.4× (14px),
running up to `4xl` at 2.6×. Buttons and inputs take `md` (8px). Dialogs take
`xl` (14px) — the largest surface gets the softest corner. Filter thumbnails and
small media previews take `md`.

Small controls clamp rather than scale: the `xs` and `sm` button sizes use
`rounded-[min(var(--radius-md),8px)]`, so shrinking a control never lets its
radius eat the label.

Two shapes sit outside the scale. **Pills** (`rounded-full`) are reserved for
controls floating on media — the crop, zoom, and ratio buttons in the editor —
and for avatars. **Hard rectangles** (no radius) belong to the media stage
itself: a cropped frame has the exact corners the export will have, so the user
is never shown a rounding the file does not contain.

Borders are 1px and translucent throughout. Nothing in the system uses a double
border, an inset ring, or a decorative outline; the 3px focus halo at 50%
opacity is the only ring that exists.

### Named Rules

**The Honest Crop Rule.** The crop stage and any true media preview render with square corners. Rounding is chrome; the exported file has none of it.

**The Pill-For-Floating Rule.** `rounded-full` marks a control as detached and sitting on media. Never use a pill for a control that sits on a token surface.

## Components

### Buttons

- **Shape:** Gently rounded (8px, `--radius-md`), 36px tall (`h-9`), inset 10px horizontally, 1.5px gap to a 16px icon.
- **Primary (`default`):** `Bright Paper` fill with `Ink Inverse` text; hover drops the fill to 80% opacity.
- **Secondary:** `Raised Gray` fill; hover mixes 5% foreground into the fill via `color-mix(in oklch, …)` rather than a hardcoded lighter gray.
- **Ghost:** Transparent; hover fills `muted/50`. The default for icon actions and toolbar controls.
- **Outline:** Transparent with a `Hairline` border and `shadow-xs`; in dark, a 30%-opacity input fill.
- **Destructive:** Not a red fill — a 20%-opacity red wash behind `Alarm Red` text, so danger reads as a warning rather than as a primary action.
- **Link:** `Bright Paper` text with a 4px underline offset, underlined on hover only.
- **Hover / Focus / Press:** All variants transition `all`. Focus shows a 3px `focus-ring/50` halo plus a solid ring border. Press translates down exactly `1px` (`active:translate-y-px`) — suppressed on menu triggers, which stay put while their popup is open.
- **Sizes:** `xs` 24px, `sm` 32px, default 36px, `lg` 40px, with square `icon-*` counterparts at the same heights.

### Inputs / Fields

- **Style:** 36px tall, 8px radius, transparent fill over a 3% white wash in dark, `Input Hairline` border, `shadow-xs`.
- **Focus:** Border shifts to the ring color and a 3px `ring/50` halo appears. The transition animates `color` and `box-shadow` only, so nothing reflows.
- **Error:** `aria-invalid` turns the border `Alarm Red` at 50% and the halo to red at 40%. The `Field` wrapper turns its own label red via `data-invalid`. Messages animate in with `fade-in slide-in-from-top-1` over 200ms.
- **Disabled:** 50% opacity, pointer events off, `cursor-not-allowed`.
- **Grouping:** `FieldGroup` stacks fields at 28px (`gap-7`); a field's own label-to-control gap is 12px.
- **Affordances inside fields:** Trailing controls (password reveal, date picker) are ghost icon buttons absolutely positioned at `inset-y-0 right-1`, with their hover fill and press-nudge suppressed so the field doesn't twitch.

### Dialogs

- **Corner Style:** 14px (`rounded-xl`), the softest corner in the system.
- **Background:** `Panel Gray`, no border.
- **Scrim:** `bg-background/10` with `backdrop-blur-xs`. The close button lives on the *scrim*, at `top-4 right-4`, not inside the panel — so a dialog containing edge-to-edge media is never interrupted by its own chrome.
- **Motion:** 100ms fade plus `zoom-95` on open and close.
- **Sizing:** Caps at `calc(100% - 2rem)`; a dialog that must grow animates `max-width` over 300ms `ease-out` with `motion-reduce:transition-none`.

### Tabs

- **Style:** The `line` variant is the system default for panel navigation — transparent list, no pill, no track.
- **States:** Inactive triggers are `Muted Ink`; hover lifts to `Ink`; active draws a 2px `foreground` underline via an `::after` that fades opacity rather than sliding.

### Sliders

Sliders are the adjustment language of the editor: a label on the left, the live
numeric value on the right in 12px `Muted Ink`, and the track beneath. The value
readout is always visible — an adjustment the user cannot quantify is an
adjustment they cannot undo by eye.

### The Editor Stage (signature)

The crop/edit stage is the most characteristic surface in Framey and the one new
work should study before adding another.

- A square container on `Room Black`, with the media fitted to the chosen ratio and no frame, shadow, or radius around it.
- Floating tool pills (`bg-background/80`, `backdrop-blur-sm`, `shadow-sm`, `rounded-full`) inset 12px from the bottom edge, holding crop-ratio and zoom controls.
- A rule-of-thirds grid of 1px `foreground/70` lines that fades in over 150ms **only while the user is dragging**, then fades out. Guides appear in response to intent, never at rest.
- Effects composited live in CSS: a `mix-blend-soft-light` wash for temperature, a flat `foreground` veil for fade, and a radial gradient for vignette — layered over a `filter` chain, so what the user sees is what the canvas exports.
- A 18rem panel that slides in beside the stage for filters and adjustments, with its contents fading in at a 300ms delay so the panel arrives before its contents do.
- Filter presets shown as a 3-column grid of live-rendered thumbnails of the user's own image — never a stock swatch. The selected one takes a `Raised Gray` fill.

### Named Rules

**The Guides-On-Intent Rule.** Alignment aids (thirds grid, snap lines, handles) appear when the user is manipulating and disappear when they stop. A guide visible at rest is clutter drawn on top of a photograph.

**The Own-Image Preview Rule.** Any preview of an effect renders the user's actual media. Never a generic sample.

## Do's and Don'ts

### Do:

- **Do** keep every new interface color at zero chroma. `Alarm Red` (`oklch(0.704 0.191 22.216)`) is the only hue the chrome is allowed.
- **Do** build depth by stepping surface lightness — 0.145 → 0.205 → 0.269 — and separating with 10%-white hairlines.
- **Do** give every media surface square corners and no frame. The photo touches the background directly.
- **Do** render text inputs at 16px below `md` to stop iOS zoom, dropping to 14px above it.
- **Do** keep controls at 36px (`h-9`) with an 8px radius, and let `active:translate-y-px` be the whole of the press feedback.
- **Do** show a live numeric readout beside any slider.
- **Do** pair every `transition-*` with `motion-reduce:transition-none`, as the editor's panel and the dialog's max-width already do.
- **Do** preview filters and effects on the user's own image.
- **Do** grow a container by exactly the width of the panel arriving inside it, and leave the stage's own size untouched.

### Don't:

- **Don't** introduce gradients, glass cards, or glowing borders. The generic gradient-SaaS look is a confirmed anti-reference.
- **Don't** introduce neon, saturated accents, or colored glows. Chrome color competes with the photographs and loses the product its point.
- **Don't** wrap media in a thick frame, drop shadow, or decorative border.
- **Don't** add a shadow to raise a surface. Raise it by lightness; shadow means "floating over unpredictable media."
- **Don't** darken a modal scrim to solid black — it blurs at 10% so the work stays visible behind it.
- **Don't** add a second typeface. Inter carries display through label by weight alone.
- **Don't** put two `Bright Paper` filled buttons in one view.
- **Don't** leave alignment guides visible at rest; they belong to the drag, not to the layout.
- **Don't** use opaque gray borders. Hairlines are white at 10–15% so they stay correct on any surface level.
