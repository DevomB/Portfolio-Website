---
name: Devom Brahmbhatt Portfolio
description: Portfolio for a trader, engineer, and researcher. Black canvas, two committed hues, a poker deck as the brand object.
colors:
  # brand — the only three values that are ever edited (src/app/globals.css)
  astroblack: "#000000"
  royal-purple: "#7c00ff"
  joker-green: "#09ff00"
  # semantic — derived from the three above
  bg: "#000000"
  surface: "#0b0810"
  surface-elevated: "#120c1c"
  border: "rgb(124 0 255 / 0.28)"
  ink: "#f2eefa"
  muted: "#9a8fb0"
  accent: "#7c00ff"
  accent-dim: "#a35cff"
  accent-bg: "rgb(124 0 255 / 0.16)"
  code-bg: "#0e0916"
  secondary: "#09ff00"
  secondary-dim: "#5cff55"
  secondary-bg: "rgb(9 255 0 / 0.12)"
  danger: "#ff4d5e"
  warn: "#febc2e"
  ok: "#09ff00"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, min(5.5vw + 1rem, 13vh), 6rem)"
    fontWeight: 900
    lineHeight: 0.93
    letterSpacing: "-0.05em"
  wordmark:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontVariationSettings: '"wdth" 125'
    fontSize: "clamp(2.1rem, 12.7vw, 15.7rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.35rem + 2.2vw, 2.25rem)"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem)"
    fontWeight: 600
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(0.9375rem, 0.88rem + 0.25vw, 1rem)"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem)"
    fontWeight: 400
    letterSpacing: "0.025em"
rounded:
  button: "0.5rem"
  card: "0.75rem"
  pill: "999px"
spacing:
  section-y: "clamp(2.5rem, 4vw + 1.5rem, 5rem)"
  shell-inline: "clamp(1rem, 3vw + 0.5rem, 2rem)"
  header-offset: "max(7rem, env(safe-area-inset-top) + 4.5rem)"
  max-width: "76rem"
  prose-measure: "62ch"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0.625rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-dim}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0.5rem 1rem"
  button-ghost-hover:
    borderColor: "rgb(124 0 255 / 0.4)"
    backgroundColor: "{colors.accent-bg}"
    textColor: "{colors.accent-dim}"
---

# Design System: Devom Brahmbhatt Portfolio

> **Read this first if you are a future session.** The site is **black-canvas,
> two-hue** — Royal Purple for structure, Joker Green for signal — with a
> poker deck as its brand object. Earlier revisions of this file described a
> light "Field Cream / System Teal" palette. That system is gone; nothing in
> the codebase uses it. If you see cream or teal anywhere, it is stale.

## 1. Overview

**Creative North Star: "The Table"**

The site is a poker table after dark: a black felt canvas, one purple light,
one green signal, and cards as the only physical objects. It reads two ways
at once. Anyone gets the surface — big name, clear rows, direct copy. A
developer gets the substrate — `//` section labels set as code comments, a
server log that types itself in on load, SQL ghost text in the hero, a fake
shell for the 404, a splash that deals cards before the page appears.

Precision-document structure, not marketing-page structure: rows over card
grids, hairline dividers over fills, type scale over decoration. The single
loud gesture is permitted — the hero H1 and the footer wordmark are huge —
and everything else stays quiet so that gesture lands.

**Key characteristics**
- Black is the canvas, never a "dark mode" of something lighter.
- Two hues, each with one job: purple is structure, green is signal.
- Five type families, one job each (see §3). Mono is data; the sans faces are language.
- The deck is the brand: favicon, Apple icon, OG card, and splash all use it.
- Reticent interaction: nothing moves until you act, then it moves briefly.

## 2. Colours

### The three brand tokens
Every colour on the site derives from three custom properties at the top of
`src/app/globals.css`. **Edit colours there and nowhere else.**

| Token | Value | Name |
|---|---|---|
| `--brand-black` | `#000000` | Astroblack |
| `--brand-purple` | `#7c00ff` | Royal Purple |
| `--brand-green` | `#09ff00` | Joker Green |

Each has an `--brand-*-rgb` twin holding raw channels (`124 0 255`); the
semantic tokens below are built from channels the same way, which is what
lets Tailwind's `/opacity` modifier work on them.

### Semantic tokens (derived)
Exposed to Tailwind as `bg`, `surface`, `surface-elevated`, `border`, `ink`,
`muted`, `accent`, `accent-dim`, `accent-bg`, `code-bg`, `secondary`,
`secondary-dim`, `secondary-bg`, `danger`, `warn`, `ok`.

- **bg** `#000000` — the page. Everything sits on this.
- **surface** `#0b0810` / **surface-elevated** `#120c1c` — near-black with a
  purple cast. Server log, chips, pills, the navbar drawer, legal summary
  cards.
- **border** purple at 28% — every divider and hairline.
- **ink** `#f2eefa` — primary text. **muted** `#9a8fb0` — secondary text,
  dates, taglines, footer links.
- **accent** `#7c00ff` — Royal Purple. The hero H1, the navbar dot, borders,
  the primary button fill, project row indices.
- **accent-dim** `#a35cff` — purple lifted for legibility as *text* on black:
  the footer `DEVOM` wordmark, link hover, legal-page links.
- **secondary** `#09ff00` — Joker Green. The `//` section labels, the live
  dot in the navbar, the server log's `ready` line, the pip on the front
  card of the mark. Also doubles as `ok`.
- **code-bg** `#0e0916` — behind terminal and code blocks.
- **danger / warn** — the 404's error line, and the first two window
  lights in a terminal chrome strip (the third is `ok` green).
- `--color-card-*` — the playing cards in the splash and PokerLab. Physical
  objects, so they keep white faces and true red/black pips.

### Named rules
**The Two-Hue Rule.** Purple and green are the palette. No third hue. Tonal
variation steps purple or green toward black, or uses alpha over black.

**Purple is structure, green is signal.** Purple marks what holds the page up
— headings, borders, the wordmark, actions. Green marks what is *live* or
*labelled* — status dots, section identifiers, a successful log line, the pip.
If green appears on a heading or purple on a status dot, it is wrong.

**Alpha is a modifier.** Every solid token is defined by its RGB channels
(`--color-muted-rgb: 154 143 176`) and mapped in Tailwind with
`<alpha-value>`, so `text-muted/60`, `bg-bg/90`, and `border-accent/25`
emit real CSS. The three tokens that are already translucent — `border`,
`accent-bg`, `secondary-bg` — are plain values and take no modifier. To
change a colour, edit its `*-rgb` line in `globals.css`; the hex in the
comment is documentation only. (Before 2026-09-04 the modifier silently
emitted nothing; if an old screenshot looks brighter than the site, that
is why.)

## 3. Typography

Five families, one role each, all self-hosted at build time via
`next/font/google` (no runtime request ever goes to Google). Decided in the
font lab on 2026-09-03; the lab itself is deleted. Roles are CSS variables
set in `src/app/layout.tsx` and exposed as Tailwind utilities in
`tailwind.config.js`:

| Utility | Family | Role |
|---|---|---|
| `font-sans` (default) | IBM Plex Sans 400–700 | body copy, row names, taglines, legal prose |
| `font-display` | Bricolage Grotesque | the hero (name line + H1), the splash, and small UI chrome: nav links, buttons, pills |
| `font-title` | Space Grotesk 700 | page titles and section headings on project, demo, and legal pages |
| `font-mono` | Geist Mono | everything machine-facing: `//` labels, dates, all numerals, chips, footer links, the navbar clock, code, terminals |
| `font-wordmark` | Anybody, `"wdth" 125` | both wordmarks — the navbar `DEVOMB.COM` and the footer `DEVOM` |

**Why the split.** The home page has no large headings — it is a hero and
then rows — so the body face carries almost everything and needs to be a
quiet workhorse (Plex Sans). Bricolage is loud and slightly odd, which is
right for the hero and for buttons but tiring at paragraph length. Space
Grotesk gives the inner pages a title voice the home page never needs.
Anybody run wide makes the wordmark the one object on the site with a shape
nothing else has. Geist Mono is the single monospace so every date, label,
and code line matches; a sixth family was rejected on exactly this ground.

### Where the type actually lives
Usage counts in the codebase: `text-fluid-xs` ≈ 69 uses, `text-fluid-sm`
≈ 24, `text-fluid-4xl` = 5, and **none of the large sizes are on the home
page**. The home page is a hero followed by rows of 13px semibold names,
13px taglines, and 11px mono dates. Judge any typeface at 11–13px first.

### Hierarchy
- **Display** — hero H1 only. Bricolage 900 (`font-display`), `clamp(2.75rem, min(5.5vw +
  1rem, 13vh), 6rem)`, leading 0.93, tracking `-0.05em`, colour **accent**.
  The tallest thing on the page; the `13vh` term keeps it inside the fold.
- **Wordmark** — both wordmarks. The navbar `DEVOMB.COM` sets it at
  `text-fluid-sm`; the footer `DEVOM` is the same face at display scale:
  Anybody 800 at 125% width
  (`font-wordmark`, `font-variation-settings: "wdth" 125`) in **accent-dim**,
  `clamp(2.1rem, 12.7vw, 15.7rem)`, centred, pulled 5px up into the copyright
  line. The size was derived by measuring glyph advances so the word spans
  the same ~58vw it did in Bricolage; retune here if the tracking changes.
- **Page title** — Space Grotesk (`font-title`), `text-fluid-4xl`, 700,
  tracking tight, colour ink. Project pages, the poker lab, the legal pages.
  Section `h2`s on those pages use the same face at `text-fluid-xl`. Not on
  the home page.
- **Title** — Plex Sans (`font-sans`), `text-fluid-sm` 600, ink. Row names:
  job titles, project names.
- **Body** — Plex Sans, `text-fluid-base` 400, leading 1.65, muted. Measure 62ch
  (`.prose-readable`). Legal pages are the longest prose on the site.
- **Label / Mono** — Geist Mono at `text-fluid-xs`. Section identifiers
  (`// experience`, in **secondary**), dates, chips, footer links, the
  the navbar clock, terminal output, row indices. All numerals on
  the site are mono with `tabular-nums` so columns align.

### Named rules
**Mono = data.** Dates, stack items, code, terminal lines, indices, section
identifiers, the URL — Geist Mono, and only Geist Mono. Names, titles,
sentences — a sans, chosen by role: Plex for content, Bricolage for chrome,
Space Grotesk for inner-page titles.

**One heading per section.** A section is titled by its `//` label *or* a
heading, never both saying the same thing. Home sections use the label only.

## 4. The mark

**The fan** — two playing cards mid-deal, the back card rotated −18°, the
front card +7°, the front carrying a `D` and a Joker Green diamond pip.
Purple strokes on near-black faces.

- Source of truth: `src/app/icon.svg` (the favicon, 64-unit viewBox).
- Same geometry as JSX in `src/app/mark.tsx`, used by
  `apple-icon.tsx` (180², on a purple-black radial) and
  `opengraph-image.tsx` / `twitter-image.tsx` (1200×630).
- The splash deals a full deck; the fan is that deal frozen at its best frame.

Do not redraw it per surface. Change `icon.svg` and `src/app/mark.tsx` together.

## 5. Elevation and interaction

Flat by default on a black canvas, where depth comes cheaply from
`surface` → `surface-elevated` steps and purple hairlines.

- `shadow-card` (black 50% + purple ring 8%) is used on the mobile nav drawer
  and the 404 terminal; `.card-soft` carries it too. Acceptable on floating or
  windowed objects. Not on rows, not on sections.
- Linked rows fade to 70% opacity on hover. No lift, no fill, no scale.
- Text links shift colour (muted → ink, or accent-dim → accent).
- Buttons: primary fills accent and hovers to accent-dim; ghost hovers its
  border to purple at 40% and tints with accent-bg.
- `::selection` is purple at 40%.

**Motion.** Framer Motion via `MotionProvider`. Sections fade in once on
scroll (`viewport: { once: true }`). The loading screen plays once per hard
load and is skipped on client-side navigation; its skip hint reads
`CLICK TO SKIP` on pointer devices and `TAP TO SKIP` on touch, via a CSS
media query. `prefers-reduced-motion` is honoured in `globals.css`. Nothing
loops.

## 6. Components

**Layout: colocated by feature.** `src/app` is organised in route groups, so a
directory is a dependency cluster, not a file kind: `(home)` holds the page,
its sections, the splash, its data and hooks, and the project detail pages;
`(poker)` holds the poker lab, the landscape, both API routes, and the engine
(`poker.ts`); `(legal)` holds both policies and their shell; `(chrome)` holds
what every route shares (Navbar, Footer, IntentLink, MotionProvider); the 404,
the brand mark, and the metadata images sit at the app root. Route groups add
no URL segment, so nothing public moved. Tectonix scores modularity on the
first three path segments, and this layout is why its cross-module edge count
fell from 39 of 49 to 15 of 55.


**Navbar.** Fixed, 3.5rem tall. Transparent at the top; on scroll `bg` at
90% with `backdrop-blur-xl` and a purple 25% bottom border. Left: the
wordmark `DEVOMB.COM` in Anybody 800 at 125% width (`font-wordmark`),
`text-fluid-sm`, all caps, the `.` in accent — the footer wordmark at reading
size, so the header and footer read as one object. Centre:
About / Experience / Projects. Right: a live clock with a green dot
(`tabular-nums`), and a GitHub pill. Mobile: hamburger opens a drawer on `bg`.

**Hero.** One viewport tall (`.hero-fold`), vertically centred on the
viewport. Name line in `text-2xl` semibold ink, then the H1 in accent, a
38ch muted paragraph, primary + ghost buttons. On `lg` a 400px right column
holds the server log. Behind everything: three soft purple `rounded-full`
glows and `.sql-ghost` statements in Geist Mono at 14% purple, rotated a
degree or two, `pointer-events: none`.

**Server log.** `rounded-xl`, purple 25% border, `surface` background, Geist
Mono at `text-fluid-xs`. Chrome strip with the filename left and three
window lights right — `danger`, `warn`, `ok` at full strength, the macOS
order, no dimming. Lines
type in on a stagger; the final `ready` line is green.

**Section label.** `// name` in Geist Mono, `text-fluid-xs`, colour
secondary, `tracking-wide`, `mb-10`. Every home section starts with one.

**List row.** The home page's primary container. Hairline top divider, a
mono gutter (index or year, `tabular-nums`), a `text-fluid-sm` semibold
title, a muted tagline, optional chips. `py-5` to `py-7`. Linked rows fade
on hover. Never a card.

**Side quests.** The one place cards are allowed, because these are
objects, not rows: two `.card-soft` cards after Projects, each a 16:9
screenshot over a name, a one-line blurb in the repo's own voice, and a
`site ↗` link out. Below them, `also built —` in mono: names and links
only. Data in `src/app/(home)/sideQuests.ts`. Nothing here is a demo or gets a
project page.

**Chips.** `.chip-soft` (surface, border, ink) for stack items; `.chip-accent`
(accent-bg, accent-dim) for status like `live`. Mono, `text-fluid-xs`.

**Footer.** Top hairline in purple 22%. A centred row of mono links —
GitHub · LinkedIn · NPM · Crates · Privacy · Terms — with 2.5rem gaps, then
`© 2026 Devom Brahmbhatt` at 60% opacity, then the `DEVOM` wordmark. No
status widgets, no timestamp.

**Legal pages.** `/privacy` and `/terms` share `src/app/(legal)/LegalPage.tsx`: back link,
page title, lede, "last updated", a `.card-soft` short-version box, then
hairline-separated sections at 62ch. Links underline in accent.

**404.** A terminal window: chrome strip, then `> GET <path>` with the real
missed path read in the browser, the error line in danger, and a
`Did you mean: <route> ?` computed by `src/app/suggestRoute.ts` against the
live route list (falls back to `/` when nothing is close). One button: Go home.

**Splash.** Full-screen deal animation on hard load, cards on the black
felt, `CLICK/TAP TO SKIP` bottom-centre in mono at 0.58rem, 0.16em tracking.

## 7. Loading policy

Nothing loads unless it is on screen, about to be, or the visitor has shown
intent. Ranked by how likely the next click is:

- **Primary paths prefetch on viewport** (Next's default): the project rows
  on the home page, and the home link from inner pages. These are what people
  click, so their route payload is fetched as soon as the row scrolls in.
- **Secondary and heavy paths prefetch on intent** via
  src/app/(chrome)/IntentLink.tsx: the footer's Privacy and Terms, and the
  "Open live demo" link to the card desk. Pointer-enter, keyboard focus, or
  touch warms the route once; nothing is fetched for a visitor who only
  scrolls past. (In the App Router, prefetch={false} also disables hover
  prefetch, which is why intent is wired by hand.)
- **Heavy interactives load on intent, not with their page.** PokerLab is a
  dynamic import inside PokerLabModal, warmed when the trigger is hovered or
  focused and rendered only when the modal opens. The project page no longer
  ships the lab or framer-motion's domMax features to readers who never open
  it. The card desk is its own route and loads only when visited.
- **Fonts preload only where they paint.** Space Grotesk (inner-page titles)
  is preload: false — it self-hosts and loads on first use with a
  metric-matched fallback, instead of costing every home visitor ~22KB for a
  face the home page never uses. The other four are visible above the fold
  and stay preloaded.
- **Assets are first-party.** The stack icons are checked into public/icons
  (CC0, coloured in the live palette) and lazy-loaded; no page makes a request
  to a third-party CDN. Screenshots in the side quests go through next/image
  and load lazily.

- **The Tectonix chart is live data with an offline floor.** On every push,
  .github/workflows/tectonix-history.yml scores the new commits with the real
  binary and publishes history/<branch>.json to the tectonix-history data
  branch (never a commit on a code branch, so no doubled deploys). The home
  page fetches that file server-side for the branch it was deployed from and
  revalidates every five minutes; if it is missing or unreachable the bundled
  src/app/(home)/tectonixHistory.json renders instead. Visitors never contact
  GitHub. Refresh the bundled snapshot occasionally with pnpm tectonix:history.

The measuring scripts (netlog, metrics, cpu-profile) live outside the repo;
the numbers that justified each rule are in the commit messages.

## 8. Do's and don'ts

### Do
- **Do** edit colours only in the three `--brand-*` tokens. Everything else
  is derived.
- **Do** use the `/opacity` modifier on solid tokens (`text-muted/60`,
  `bg-bg/90`) and `opacity-*` only when the whole element should fade.
- **Do** keep purple for structure and green for signal.
- **Do** put content in rows with hairlines, not in cards.
- **Do** set every number in mono with `tabular-nums`.
- **Do** use the fan mark from its two sources; never a per-surface redraw.
- **Do** keep the loud gestures to two: the hero H1 and the footer wordmark.
- **Do** judge type decisions at 11–13px, where the site actually lives.

### Don't
- **Don't** hardcode hex values in components. Use `var(--color-*)` or the
  Tailwind token names. (The `next/og` image files are the one exception —
  the renderer cannot read CSS variables — and they mirror the tokens in a
  comment.)
- **Don't** introduce a third hue, a sixth type family, a second monospace,
  or a shadow on a resting row.
- **Don't** add motion that runs without the user: no loops, no
  scroll-jacking, no continuous movement. Load once, respond to hover/focus.
- **Don't** build icon + heading + text card grids, side-stripe accents,
  gradient text, hero metrics, testimonial carousels, or gradient blobs.
- **Don't** give a section both a `//` label and a heading saying the same
  thing.
- **Don't** describe the site as "dark mode". There is no light mode. Black
  is the canvas.
