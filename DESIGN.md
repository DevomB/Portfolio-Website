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
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "0.5rem 1rem"
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
server log that types itself in on load, a fake shell for the 404, a splash
that deals cards before the page appears, once a visit.

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
- **accent** `#7c00ff` — Royal Purple. Borders, the primary button fill, the
  wordmark's `.` — and, as text, only at 24px and up, which in practice is the
  hero H1 (it is 3.3:1 on black).
- **accent-dim** `#a35cff` — purple lifted for legibility as *text* on black
  (5.5:1): every purple word under 24px — links, project row indices, the
  "live demo" tag, labels — and the footer `DEVOM` wordmark.
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

**Alpha is a modifier — for surfaces, never for text.** Every solid token is
defined by its RGB channels (`--color-muted-rgb: 154 143 176`) and mapped in
Tailwind with `<alpha-value>`, so `bg-bg/90` and `border-accent/25` emit real
CSS. Text never takes a modifier (see the text rules below). The three tokens that are already translucent — `border`,
`accent-bg`, `secondary-bg` — are plain values and take no modifier. To
change a colour, edit its `*-rgb` line in `globals.css`; the hex in the
comment is documentation only. (Before 2026-09-04 the modifier silently
emitted nothing; if an old screenshot looks brighter than the site, that
is why.)

### Text rules (R1–R3)
Checked on every route by compositing each text colour, times every
ancestor's opacity, over its real background stack.

- **R1 — contrast.** All text is at least 4.5:1 against what is actually
  behind it; 3:1 at 24px and up, or 18.66px bold. Exempt: the `.` in the
  `DEVOMB.COM` wordmark, disabled controls, hover states.
- **R2 — full-strength tokens.** Text wears `ink`, `muted`, `accent-dim`,
  `secondary`, `danger`, `warn` or `ok` — never an alpha modifier
  (`text-muted/70`) and never inside anything carrying `opacity-*` at rest.
  `accent` is text only at 24px and up. On a dark surface a red suit is
  `danger`; `--color-card-red` is for the white card faces.
- **R3 — an 11px floor.** Nothing is smaller than `text-fluid-xs` (11px).
  The one exception is the 13×13 hand matrix on the Landscape and Decisions,
  whose labels floor at 9px (10px at `xl`, where its sidebar grows to 360px).
  SVG charts draw at the width they are shown — `useWidth()` in `(chrome)`,
  one unit to a pixel — so their labels are 11px on a phone as on a desk; a
  label that cannot fit its cell at that size is left out, not shrunk.
- Labels on computed fills (the Mirage heat map) are black or white by
  `labelOn(oklchLuminance(...))` in `src/lib/color.ts`, which clears 4.5:1 on
  either side of the tie. Playing cards keep a solid white face under their
  sheen, so they are measured against white.

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
`text-fluid-xs` is by far the most used size — every label, chip, caption
and demo control — then `text-fluid-sm`, and **none of the large sizes are on
the home page**. The home page is a hero followed by rows of 13px semibold names,
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
- **Label / Mono** — Geist Mono at `text-fluid-xs`, the smallest size on
  the site. Section identifiers (`// about`, in **secondary**), dates, chips,
  footer links, the navbar clock, terminal output, row indices, every demo
  control and caption. All numerals on the site are mono with
  `tabular-nums` so columns align.

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
  `apple-icon.tsx` (180², on a purple-black radial) and by `ogCard.tsx`, the
  1200×630 link-preview card behind the root's and every project and demo
  page's `opengraph-image` / `twitter-image`.
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
- Buttons: primary fills accent with white text and hovers to accent-dim —
  never dark text on purple; ghost hovers its border to purple at 40% and
  tints with accent-bg. Both come from `(chrome)/Button.tsx` (see §6).
- `::selection` is purple at 40%.

**Motion.** Framer Motion via `MotionProvider`. Sections fade in once on
scroll (`viewport: { once: true }`). The splash plays once a visit — on the
first hard load of `/` in a browser session — and never on client-side
navigation, even to `/`; `?hand=` previews force it (see §6). Its skip hint
reads `CLICK TO SKIP` on pointer devices and `TAP TO SKIP` on touch, via a
CSS media query. `prefers-reduced-motion` is honoured in `globals.css`.
Nothing loops.

## 6. Components

**Layout: colocated by feature.** `src/app` is organised in route groups, so a
directory is a dependency cluster, not a file kind: `(home)` holds the page,
its sections, the splash, its data and hooks, and the project detail pages;
`(poker)` holds the poker lab, the landscape, the decisions surface, the three
API routes, and the engine (`poker.ts`); `(pallas)` holds the Mirage and the
Adversarial Tape with their worker, worlds and tapes; `(ananke)` holds the
Counterexample; `(legal)` holds both policies and their shell; `(chrome)`
holds what every route shares (Navbar, Footer, IntentLink, MotionProvider,
Button, the `useWidth` and `useMoreRight` hooks, `pageMetadata`, and DemoPage —
the shell every demo page is built on, footer included); `src/lib` holds
dependency-free helpers; the 404, the brand mark, and the metadata images sit
at the app root. Route groups add no URL segment, so nothing public moved.
Tectonix scores modularity on the first three path segments, and this layout
is why its cross-module edge count fell from 39 of 49 to 22 of 114.

**Rules.** `.tectonix/rules.toml` states the architecture Tectonix checks on
every push: no cycles, no function over 100 lines or cyclomatic 25, and the
layers home → demos → engine → chrome → lib, each importing only what sits
beneath it. A worker's message types live with the domain they describe
(`worlds.ts`, `tape.ts`), never in the worker, so no page imports a worker
and the longest import chain stays at three. Helpers have one home each:
`src/lib/num.ts`, `(pallas)/gaussian.ts`, `(pallas)/format.ts`,
`api/poker/engine.ts`.


**Navbar.** Fixed, 3.5rem tall. Transparent at the top; on scroll `bg` at
90% with `backdrop-blur-xl` and a purple 25% bottom border. Left: the
wordmark `DEVOMB.COM` in Anybody 800 at 125% width (`font-wordmark`),
`text-fluid-sm`, all caps, the `.` in accent — the footer wordmark at reading
size, so the header and footer read as one object. Centre: About and
Projects, linked as `/#about` and `/#projects` so they work from every page
(on home they smooth-scroll). Right: Devom's clock — `Eastvale · 1:05 AM PT`,
America/Los_Angeles to the minute, re-rendered on the minute and never on the
server — with its green dot, in tabular mono; and a GitHub pill. Mobile: a
hamburger opens a drawer on `bg` with About, Projects, GitHub and the clock.

**Hero.** One viewport tall (`.hero-fold`), vertically centred on the
viewport. Name line in `text-2xl` semibold ink, then the H1 in accent, the
intro line in muted at a 38ch measure (two lines at most; it names the work,
not the location), then a primary and a ghost button. On `lg` a 400px right
column holds the server log. Nothing behind it: black.

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
on hover. Never a card. The whole row is the link, so its "live demo" is a
tag in accent-dim, not a second link, and carries no arrow.

**Side quests.** The one place cards are allowed, because these are
objects, not rows: two `.card-soft` cards after Projects, each a 16:9
screenshot over a name, a one-line blurb in the repo's own voice, and a
`site ↗` link out. Data in `src/app/(home)/sideQuests.ts`. Nothing here is a
demo or gets a project page.

**Chips.** `.chip-soft` (surface, border, ink) for stack items; `.chip-accent`
(accent-bg, accent-dim) for status like `live`. Mono, `text-fluid-xs`.

**Footer.** On every page, the demos included. Top hairline in purple 22%.
A centred row of mono links — GitHub · LinkedIn · NPM · Crates (the
`PROFILES` in `src/lib/site.ts`, which the home page's JSON-LD reads too) ·
Privacy · Terms — with 2.5rem gaps, then `© 2026 Devom Brahmbhatt` in muted,
then the `DEVOM` wordmark. No status widgets, no timestamp.

**Legal pages.** `/privacy` and `/terms` share `src/app/(legal)/LegalPage.tsx`: back link,
page title, lede, "last updated", a `.card-soft` short-version box, then
hairline-separated sections at 62ch. Links are accent-dim, underlined in purple.

**404.** A terminal window: chrome strip, then `> GET <path>` with the real
missed path read in the browser, the error line in danger, and a
`Did you mean: <route> ?` computed by `src/app/suggestRoute.ts` against the
live route list (falls back to `/` when nothing is close). One button: Go home.

**Splash.** Full-screen deal animation, cards on the black felt, once a
visit. `PageWrapper` decides it from three signals: the navigation entry
(this document was loaded at `/` — landing inside and clicking home never
plays it), module scope (not yet played in this JS context), and
sessionStorage (not yet played this session, so a reload of `/` goes straight
to the page; if storage throws, it plays). `?hand=` always plays. The
composition is a 680px box scaled to fit; below a scale of 1 the subtitle and
the hand label leave the ring and sit just under its lowest card at
`text-fluid-xs`, same colours, tracking and timing, while the name stays in
the ring. The hand label is ink, green for a pair or better, glowing for a
full house or better. `CLICK/TAP TO SKIP` sits bottom-centre in mono at
`text-fluid-xs` in muted, 0.16em tracking.

**Buttons.** `Button` and `ButtonLink` in `(chrome)/Button.tsx`, primary or
ghost, `md` or `sm`: the only way the site draws one. `ButtonLink` opens an
absolute URL in a new tab and prefetches an internal route the Next way, or
on intent (`prefetch="intent"`, through IntentLink) for the heavy ones.

**Arrows.** `↗` only on a link that leaves devomb.com in a new tab. An
internal link gets `→` or nothing.

**Project pages.** One call-to-action row, in one order: "Open live demo"
(primary), the project's other demos (ghost), View source, then its registry
— npm, crates.io or PyPI, each a ghost button with the same package icon.

**Charts and tables in the demos.** The Pallas line chart draws its frame and
a one-line empty state until a series has data, and `axisTicks()` never
writes two gridlines the same way. A table too wide for a phone scrolls in
its own box, never the page: its first column pinned (background clipped to
the padding box so the row lines survive), and a right-edge fade from
`useMoreRight()` while there is more to the right. Rank pickers show all
thirteen ranks in a row or a deliberate 7 + 6, never a lone card.

**Metadata and previews.** Every page builds its metadata with
`pageMetadata()`: the title (the layout templates it as
`%s · Devom Brahmbhatt`; the default is the hero's line), the description,
the canonical URL, and the Open Graph and Twitter fields. Project and demo
pages have their own preview card — `src/app/ogCard.tsx`, the root card's
layout with the page's kicker and title — and home, privacy and terms use
the root card. `src/app/sitemap.ts` lists every public page from the project
data; `robots.ts` allows all and points at it.

## 7. Loading policy

Nothing loads unless it is on screen, about to be, or the visitor has shown
intent. Ranked by how likely the next click is:

- **Primary paths prefetch on viewport** (Next's default): the project rows
  on the home page, and the home link from inner pages. These are what people
  click, so their route payload is fetched as soon as the row scrolls in.
- **Secondary and heavy paths prefetch on intent** via
  src/app/(chrome)/IntentLink.tsx: the footer's Privacy and Terms, and every
  demo link on the project pages (`ButtonLink prefetch="intent"`). Pointer-enter, keyboard focus, or
  touch warms the route once; nothing is fetched for a visitor who only
  scrolls past. (In the App Router, prefetch={false} also disables hover
  prefetch, which is why intent is wired by hand.)
- **Heavy interactives load on intent, not with their page.** Every demo is
  its own route, warmed when its link is hovered, focused or touched and
  loaded only when visited; the project pages ship none of them, nor
  framer-motion's domMax features (Poker Lab's own subtree loads those).
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
  GitHub. The bundled snapshot is CI's own file, refreshed with pnpm
  tectonix:pull; the workflow builds tectonix's tree-sitter grammars from
  pinned commits, because the release it would download them from does not
  exist, and refuses to score until they load.
- **Engine builds are fetched, not committed.** The Pallas arena (.wasm) and
  the Ananke bridge (js_of_ocaml output) live on the orphan artifacts branch,
  pinned by commit and sha256 in artifacts.lock.json; scripts/fetch_artifacts.mjs
  runs before every build and dev server and downloads exactly those bytes when
  the local copy is missing or differs. Build products stay out of the source
  tree, so every analysis of the code is about the code.

The measuring scripts (netlog, metrics, cpu-profile) live outside the repo;
the numbers that justified each rule are in the commit messages.

## 8. Do's and don'ts

### Do
- **Do** edit colours only in the three `--brand-*` tokens. Everything else
  is derived.
- **Do** use the `/opacity` modifier on surfaces and borders (`bg-bg/90`,
  `border-accent/25`). Text takes full-strength tokens only, and nothing that
  holds resting text wears `opacity-*`.
- **Do** draw every primary or ghost button with `Button` / `ButtonLink`.
- **Do** keep purple for structure and green for signal.
- **Do** put content in rows with hairlines, not in cards.
- **Do** set every number in mono with `tabular-nums`.
- **Do** use the fan mark from its two sources; never a per-surface redraw.
- **Do** keep the loud gestures to two: the hero H1 and the footer wordmark.
- **Do** judge type decisions at 11–13px, where the site actually lives —
  and never go under 11px (the hand matrix's 9px labels are the exception).

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
- **Don't** put dark text on purple, or `↗` on a link that stays on the site.
- **Don't** give a section both a `//` label and a heading saying the same
  thing.
- **Don't** describe the site as "dark mode". There is no light mode. Black
  is the canvas.
