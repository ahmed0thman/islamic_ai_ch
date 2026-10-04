# Huda reading UI: design system and component spec

Status: (ب) research finding extracted from the bake-off prototype `design/bakeoff/claude/` (author: Claude Sonnet 5.5). Nothing here is an owner decision except where the owner's words are quoted. Items marked (ج) are proposals waiting for the owner.

Second input: the UI research report (`.cache/delegate/m-006-ui-research/final.txt`, private, 4 Oct 2026). Its decisions are folded in below and summarized in section 8. Where it contradicts my prototype, the research wins, and the places are marked "(research)".

Audience: a coding lane that builds the real reader in `app/` (Next.js 16.0.10, React 19.2, Tailwind 4.1, pnpm). Read this file, then `content/SCHEMA.md`, `app/src/lib/types.ts`, `app/src/lib/map.ts`. **Never write Arabic strings in code**: every Arabic string comes from `content/ui.ar.json` (keys are cited below as `ui.<group>.<key>`) or from `content/export/*.json`. If a label is missing, leave the control icon-only with an English `aria-label` and list it.

Owner words that drive this (4 Oct 2026): "the interface starts to reach a good level... we need professional icons, e.g. Hugeicons... we need to fix a design system... define the components so we do not write everything from scratch... clean work in everything, frontend and backend." Earlier: the old screen was "prose written one line after another"; the UI is "a very large part of the project's creativity and distinction".

## 0. Concept in five lines (what the components serve)

1. The surah is a thread. Ayahs are knots on it. Stops (titled paragraphs) are doors hanging from a knot.
2. A sticky mini strip shows the whole surah at a glance (one bead per ayah, passage rails, one pin per stop under each bead) and is also the navigator.
3. A depth dial (4 levels) reveals more doors and pins on the same screen instead of replacing the page.
4. A stop opens as a focused scene: ayah stage, question, then the explanation as continuous text with each claim's source marker at its end (dense multi-claim paragraphs may stack, see ClaimText). The next card invites; nothing auto-advances.
5. Source sheet, term sheet, legend sheet, continuous reading. Calm, no points or streaks.

Hard rules from the research (apply to every component below):

- **No prose wall inside cards and no card per sentence.** Explanation reads as continuous text by default (section 3.3, ClaimText). Cards are only for things with a different job: the stop door, the relation card, the verbatim quote, the depth item.
- **Visual variety must have meaning.** Four structures, one per job: ordinary explanation (flowing text), transmission/verbatim (quote block, never restyled), relation of two ayahs (RelationCard), depth item (DetailsItem).
- **No semantic line without a record that carries it.** A line drawn between two things is itself a claim. The thread is only the order of ayahs; a door's branch only says "hangs under this ayah" (`stop.ayahs[0]`, from the data). Nothing connects two stops to each other. Relations between ayahs appear only through RelationCard, from a `link` record.
- **No locked routes, no depth as a rank ladder** (no "beginner/expert", no numbers as levels, no locked advanced content, no reading-time promises), no points, streaks, confetti.
- **No clamping or cropping a claim before its qualification** (a closed panel must never hold the warning that qualifies a visible claim: `la_yathbut` and `khilaf_mutabar` badges stay inline next to the marker).
- **No naive filtering by ayah or passage.** Block tags (`ayahs`, `passage`) do not describe complete explanatory scope (for example the glance paragraph of Al-Duha is tagged `p1` and `93:3` but summarizes the whole surah). Reading-unit selection is navigation and focus, never a filter that hides content (section 3.1).
- **Dark mode has its own tested colors**, not an automatic inversion (section 1.1).

Design read: reading app for non-specialist Arabic readers, calm and premium, editorial-manuscript leaning, cold ink-teal neutrals (not beige/brass), `DESIGN_VARIANCE 6 / MOTION_INTENSITY 5 / VISUAL_DENSITY 4`.

## 1. Tokens

Tailwind 4: put the raw variables in `app/src/styles/tokens.css` (`:root` plus dark override), and expose them to utilities with `@theme inline` so `bg-surface`, `text-ink`, `rounded-card` etc. swap with the color scheme. One accent only. Dark mode follows `prefers-color-scheme` (no toggle in v1).

### 1.1 Color roles

```css
:root {
  color-scheme: light dark;
  --bg:        #e7eded;   /* page ground */
  --surface:   #f6f9f8;   /* cards, sheets, doors */
  --surface-2: #ecf2f1;   /* quotes, evidence blocks, track */
  --ink:       #0e1c1f;   /* primary text */
  --ink-2:     #405559;   /* secondary text */
  --ink-3:     #5f7377;   /* tertiary, labels, captions */
  --line:        rgba(14,28,31,.13);
  --line-strong: rgba(14,28,31,.24);
  --accent:      #0a5b69; /* the only accent: threads, links, terms, selected */
  --accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
  --on-accent:   #f2fbfa;
  --stage-a: #0c2a31;     /* ayah stage + hero gradient, dark teal in both modes */
  --stage-b: #0a4350;
  --stage-ink:  #eaf5f2;
  --stage-mute: #8dbbbb;
  --scrim: rgba(6,18,20,.5);
  /* source types: values come from ui.icons.<key>.color at runtime and are set inline as --tone */
  /* badges: ui.badges.<key>.color, set inline as --tone */
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#071113; --surface:#0e1c1f; --surface-2:#14272b;
    --ink:#e7f1ef; --ink-2:#a9bfbd; --ink-3:#7f9695;
    --line:rgba(231,241,239,.14); --line-strong:rgba(231,241,239,.28);
    --accent:#5ec8d6; --on-accent:#04242a;
    --stage-a:#0b2229; --stage-b:#0d3a45; --scrim:rgba(0,0,0,.62);
  }
}
```

Roles:

| Token | Role |
|---|---|
| `--bg`, `--surface`, `--surface-2` | ground, raised card/sheet, inset block (quote, evidence) |
| `--ink`, `--ink-2`, `--ink-3` | body, secondary, labels |
| `--line`, `--line-strong` | hairline, control border and thread |
| `--accent`, `--accent-soft`, `--on-accent` | thread fill, terms, selected states, primary button |
| `--stage-*` | dark ayah stage and hero question card (same dark teal in both modes) |
| `--tone` (runtime) | per-source color from `ui.icons`/`ui.badges`; never hard-code the six hex values |

Source-tone rule (keeps the six colors legible in both modes): chip background `color-mix(in srgb, var(--tone) 22%, transparent)`, glyph/text `color-mix(in srgb, var(--tone) 55%, var(--ink))`, beat rail `color-mix(in srgb, var(--tone) 70%, transparent)`. The mix target is `--ink`, so it darkens in light mode and lightens in dark mode.

Contrast: `--ink` on `--surface` and `--on-accent` on `--accent` were chosen for AA, but I did not run a contrast tool (ب, verify with Playwright axe or similar). `--ink-3` on `--bg` is the weakest pair, keep it for 12.5px+ labels only.

Mapping for shadcn/ui variable names (so copied components pick up our tokens): `--background:var(--bg); --foreground:var(--ink); --card:var(--surface); --card-foreground:var(--ink); --popover:var(--surface); --primary:var(--accent); --primary-foreground:var(--on-accent); --secondary:var(--surface-2); --muted:var(--surface-2); --muted-foreground:var(--ink-3); --border:var(--line-strong); --input:var(--line-strong); --ring:var(--accent); --radius:18px`.

Current app note: `globals.css` is grey-neutral with `--accent: var(--text-primary)`. The proposal replaces it with the teal accent and the cool neutrals above (ج, owner has seen the prototype palette but has not approved it as the palette).

### 1.2 Typography

| Role | Family | Used for |
|---|---|---|
| `--font-quran` | Amiri Quran | ayah text only (stage, thread verse, inline ayah, surah name) |
| `--font-quote` | Amiri | verbatim quotes (hadith, athar, scholar words), evidence quote |
| `--font-ui` | IBM Plex Sans Arabic (400/500/600/700) | explanation text, titles, controls |

Load with `next/font/google` (`Amiri_Quran`, `Amiri`, `IBM_Plex_Sans_Arabic`, subset `arabic`, `display: swap`, CSS variables). The app today uses Readex Pro for body and Amiri for the Quran: switching body to Plex and the Quran to Amiri Quran is a (ج) change. Amiri Quran draws the ayah text well but not the end-of-ayah number glyph, so strip it (see `ayahWords` in `reader.tsx`, keep that regex) and draw the number ourselves with `numeral()`.

Type scale (px at 16px root; use `rem` in code, i.e. divide by 16), line-height is part of the token:

| Token | Size / line-height | Use |
|---|---|---|
| `--text-cover` | `clamp(54px,17vw,72px)` / 1.55, Amiri Quran | surah name on the header |
| `--text-stage` | 30 / 2.2, Amiri Quran | ayah on the scene stage |
| `--text-verse` | 28 / 2.15, Amiri Quran | ayah on the thread |
| `--text-inline-ayah` | 25 / 2.1, Amiri Quran | ayah inside the explanation |
| `--text-title` | 28 / 1.55, 700 | scene title (the stop question) |
| `--text-hero` | 25 / 1.6, 700 | hero question |
| `--text-body` | 18 / 2.05, 400 | explanation text; 17 inside DetailsItem |
| `--text-quote` | 20 / 2.1, Amiri | verbatim quote |
| `--text-door` | 17 / 1.7, 600 | stop door title; details pin 15 / 1.75, 500 |
| `--text-sheet-title` | 19 / 1.6, 700 (term title 24) | sheet heading |
| `--text-ui` | 14-16 / 1.5-1.7, 500-600 | buttons, notches, chips |
| `--text-label` | 12.5-13 / 1.7, 600 | field labels, captions, fine print |

Arabic needs generous leading (never below 1.5 for UI, 1.8 for reading). Use `text-wrap: balance` on titles and `pretty` on verse. No letter-spacing on Arabic. Digits are Arabic-Indic via `numeral()` (`app/src/lib/numerals.ts`), with `font-variant-numeric: tabular-nums` in counters.

### 1.3 Spacing, radius, shadow, layers

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 48. Page gutter 20 (14 inside the thread), reading column padding 22, section gap 24-28.
- Radius (one scale): `--radius-s` 12 (inputs, quotes, evidence), `--radius` 18 (cards, doors, stage, sheets top is 26), `--radius-pill` 999 (buttons, chips, dial notch uses 12), circle 50% (medal, round buttons). Do not introduce other radii.
- Shadow: `--shadow: 0 1px 0 rgba(14,28,31,.04), 0 14px 28px -18px rgba(10,70,82,.45)` (tinted, not black). Dark: `0 1px 0 rgba(255,255,255,.03), 0 14px 28px -16px rgba(0,0,0,.8)`. Sheet: `0 -20px 50px -20px rgba(0,0,0,.5)`.
- Z-index: sticky strip 5, scene 20, scrim 30, sheet 31. No other z-index.
- Tap targets: standalone controls are 44x44 or larger. Inline controls (marker, term) stay visually small but must meet WCAG 2.2 target size (24px, or 24px of spacing around them; inline-text exceptions apply) (research). Do not stack large invisible `::after` hit areas on neighbors: where two inline controls are adjacent, keep at least 8px between them instead of overlapping extended areas. Standalone round buttons and chips: 44. Offer the larger stop-level source button (3.3, StopSources) as the comfortable way to open sources.

### 1.4 Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.16,1,.3,1)` | everything (no linear, no default ease) |
| `--dur-fast` | 200ms | press scale, hover |
| `--dur-base` | 250-400ms | color, opacity |
| `--dur-state` | 160-220ms (use 200) | sheets, disclosures (DetailsItem, source rows), highlight of the supported text; explains state only (research) |
| `--dur-door` | 320ms | door reveal/collapse (`grid-template-rows` 0fr to 1fr + opacity); stagger max 30ms per door, capped at 6 |
| `--dur-scene` | 320ms | scene slide-up (`translateY(104%)` to 0) and stop-to-stop slide |

The prototype used 550-700ms and a per-pulse staggered entrance; the research says motion that explains state only, 160-220ms for sheets and disclosures, and nothing continuous while reading. So: no per-pulse stagger (at most one 200ms fade of the scene body), and drop the perpetual ripple behind the surah name (research).

Motivated motion only: depth change (more doors appear in place), scene opening, stop to stop slide (direction follows reading direction: next slides in from the left in RTL), thread drawing (scroll-driven `animation-timeline: view()` inside `@supports`, static fallback), press feedback (`scale(.96-.985)`). There is no perpetual animation. Brief relationship highlight after tapping an ayah reference in a RelationCard (200ms).

Reduced motion (mandatory): under `prefers-reduced-motion: reduce` set `animation: none` on everything, `transition-duration: .01ms`, `scroll-behavior: auto`, and show the static thread. Also honor `prefers-reduced-transparency` for the blurred sticky strip (solid `--bg`).

### 1.5 Breakpoints and layout

- Mobile first, designed at 390x844. Up to 430px: full bleed, no frame.
- The phone frame (40px radius) in the prototype is a demo device only. In production use a centered reading column: `max-width: 34rem` from 48rem (`md`) up, with the page ground visible around it. Do not render a fake phone.
- Tailwind default breakpoints are fine (`sm 640`, `md 768`, `lg 1024`). A two-pane desktop layout (thread left, scene right) is (ج), not part of v1.
- Use CSS logical properties everywhere (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-s`, `text-start`). Never `left`/`right`/`ml`/`mr` (except the physical chevron geometry noted in 2.3).

### 1.6 `@theme` sketch

```css
@import "tailwindcss";
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-ink: var(--ink); --color-ink-2: var(--ink-2); --color-ink-3: var(--ink-3);
  --color-line: var(--line); --color-line-strong: var(--line-strong);
  --color-accent: var(--accent); --color-on-accent: var(--on-accent);
  --color-stage-a: var(--stage-a); --color-stage-b: var(--stage-b); --color-stage-ink: var(--stage-ink);
  --font-quran: var(--font-quran); --font-quote: var(--font-quote); --font-ui: var(--font-ui);
  --radius-s: 12px; --radius-card: 18px;
  --ease-huda: cubic-bezier(.16,1,.3,1);
}
```
(ب: verify the exact `@theme inline` behavior against Tailwind 4.1 docs when wiring; the structure is standard but I did not run it.)

## 2. Icons

Proposal (ج, needs owner approval): move all interface icons to one library, Hugeicons free tier (`@hugeicons/react` + `@hugeicons/core-free-icons`, usage `<HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.75} />`). One family, one stroke width globally. Today the app draws arrows and "x" with text characters and CSS borders. The prototype did the same; it was the weakest part, so replace them all.

Wrap it once in `components/ui/icon.tsx` (`<Icon icon={...} size?: 16|20|24 />`, `aria-hidden` by default) so swapping the library later is one file. RTL: arrows are directional, so "forward" in the reading direction points left. Use the left/right chevron by meaning, not a mirror flag, and check each icon visually.

I am not sure of most Hugeicons names. Names in the table are the ones I am reasonably confident exist in the free pack; every row says to verify, because I could not install or browse the package. Do not invent a name: search the package at install time and record the final name here.

| Need | Meaning / where | Proposed Hugeicons name |
|---|---|---|
| Close | sheets, scope chip clear | `Cancel01Icon` (verify) |
| Back / map | scene back button, back link | arrow pointing in reading-forward direction on the right side: `ArrowRight01Icon` (verify, direction) |
| Next | NextCard, scene next | `ArrowLeft01Icon` (verify, RTL meaning) |
| Previous | scene previous | `ArrowRight01Icon` (verify) |
| Door chevron | StopDoor affordance | `ArrowLeft01Icon` (verify) |
| Legend / key | LegendSheet trigger | verify at install (a key or info-in-circle; `InformationCircleIcon` is a candidate) |
| Map / thread | map view toggle | verify at install (route or map pin) |
| Continuous reading | continuous view toggle | verify at install (open book or text lines; `BookOpen01Icon` is a candidate) |
| Open source | external link in SourceSheet | verify at install (arrow up-right or external link; `Link01Icon` is a candidate) |
| Term | optional hint next to a term | none needed (dotted underline is the affordance) |
| Passage | PassageBar play/scope | verify at install (a play triangle or a layers glyph) |
| Depth | DepthDial | none needed (names and counts are text) |
| Question | HeroQuestion, scene title accent | none needed (accent bar), or `HelpCircleIcon` (verify) |
| Details open / close | DetailsItem | `PlusSignIcon` / `MinusSignIcon` (verify) |
| Visited | StopDoor seen state | `Tick02Icon` (verify) or the existing 8px dot |
| Ask | AskBox | verify at install (search or chat-question) |
| Offline | Offline notice | verify at install |

### 2.1 The six source-type icons (owner's decision area)

Currently `ui.icons.<key>.symbol` (text glyphs) plus `.color`: ayah is the ornamental flower sign, hadith `◆`, athar `▲`, scholar `■`, link `⇄`, hidaya `✦`. They are already distinguishable by shape and color together, which is the property the legend relies on ("what makes a claim trustworthy, at a glance, even for color-blind readers"). Those symbols and colors are part of the owner's decision on the markers, so changing them is a proposal only.

Proposal (ج): keep the symbol + color mechanism as the source of truth (it comes from `ui.ar.json`) and, only if the owner wants Hugeicons here, use one icon per type inside a chip whose silhouette also differs, so shape and color both carry the type:

| Type (`IconKey`) | Chip silhouette | Icon idea (name: verify at install) |
|---|---|---|
| `ayah` | circle | open Quran/book |
| `hadith` | diamond (rotated square) | speech/quote bubble |
| `athar` | triangle | person/companion or a chain link |
| `scholar` | square | book or pen |
| `link` | double-arrow capsule | two-way arrows or link |
| `hidaya` | four-point star | light/star/compass |

Never replace color-only; the silhouette is mandatory. Do not change anything until the owner approves (question Q2).

### 2.2 Source chip anatomy (used by SourceMarker, StopDoor, legend)

Chip: min 22 (small) / 26 / 40 (legend) px square, radius 7-12, tinted by `--tone`. A marker shows the union of the icons of its records in `ui.icon_order`, then one badge pill if any record has badge `la_yathbut` or `khilaf_mutabar` (label from `ui.badges.<key>.label`). `thabit` shows only inside the sheet.

### 2.3 Physical geometry exception

The chevron/arrow glyphs are drawn with physical left/bottom borders rotated 45deg so they point left (reading-forward in RTL). If you use Hugeicons this disappears; keep it only if arrows stay CSS.

## 3. Component inventory

Types are imported from `@/lib/types` (`Ui`, `Surah`, `Depth`, `Block`, `ParagraphBlock`, `Segment`, `TitleSegment`, `SourceRecord`, `Passage`, `Ayah`, `IconKey`, `BadgeKey`) and `@/lib/map` (`MapStop`, `MapStation`, `MapGroup`, `SurahMapModel`, `deriveSurahMap`, `stopNeighbours`). The derivation in `map.ts` is tested and must not be re-written. Where the prototype needs data `map.ts` does not give, it is marked **[needs lib]**.

Shared prop shape from today's `reader.tsx`: `ReadingProps = { ayahs: Map<string, Ayah>; records: Surah["records"]; ui: Ui; onOpen: (records: SourceRecord[]) => void }`. Keep it (or move it to context, see 5.3).

Conventions for every component: server component unless it holds state or events (`"use client"` listed below); no Arabic strings; every interactive element is a real `<button>`/`<a>`; focus ring `outline: 3px solid var(--accent); outline-offset: 2px`.

### 3.1 Shell and navigation

**SurahHeader** (client, because of the dial slot). Purpose: back link, app name, surah name, ayah count, the reading-unit button, surah switcher chips, legend button. Props: `{ surah: SurahSummary; surahs: SurahSummary[]; scope: Scope; ui: Ui; onOpenUnit: () => void; children?: ReactNode }`. Content: `ui.app_name`, surah name large in `--font-quran` at `--text-cover` (static faint concentric-ring backdrop, no animation), count as `numeral(ayah_count)` with `ui.icons.ayah.symbol`, `ui.tagline`. **Reading-unit button** (research): one pill under the name that always says what is being read, built from data only: surah name, then the unit (passage title with `numeral(from) - numeral(to)`, or an ayah range, or nothing for the whole surah), for example name + range. It opens ReadingUnitSheet. SurahSwitcher is a row of pill chips (`aria-pressed` for current; real links to `/s/[no]` in production, not state). Replaces: header block inside `Reader` (`reader-header`, `back-link`, `eyebrow`) and the surah list on `/`. Keyboard: chips are links; scroll-snap row.

**LegendSheet** (client). Purpose: reachable-but-not-in-the-way legend. Trigger is a pill with `ui.legend.show` and six color dots. Content: `ui.legend.title`, section `ui.legend.icons_title` listing `ui.icon_order` (chip + `label` + `meaning`), section `ui.legend.badges_title` listing the three badges. States: closed/open. Built on Sheet (4.1). Replaces: `components/legend.tsx` (keep its content logic).

**DepthDial** (client). Purpose: choose depth. Props: `{ depth: Depth; levels: Ui["levels"]; label: string /* ui.reader.choose_depth */; counts?: Record<Depth, number>; onChange: (d: Depth) => void }`. Four notches with `levels[i].name`; a sliding thumb (`translateX(calc(var(--i) * -100%))` in RTL) and a bottom fill bar. The research says depth must not look like a rank ladder and no numbers: **`counts` is optional and off by default** (the prototype showed the number of doors above each name, which can read as a score; the owner decides, Q4b). The fill bar is likewise decorative only and may be dropped. States: selected, focus, hover; at enlarged text sizes the four names wrap to two rows instead of truncating. Behavior: Radix RadioGroup semantics; arrows move by visual direction (Left = deeper in RTL), Home/End jump. Default depth: understanding (index 1). Changing depth never claims to keep the same concept: if a scene is open it closes to the map (research: stop identity across depths is not in the data; the doors that animate in place at a new depth are matched by ayah + exact title only for presentation, never as a claim). Replaces: `fieldset.depth-switch` in `Reader`.

**MiniStrip** (client, new). Purpose: the whole surah in one glance and the navigator, sticky under the header. Props: `{ groups: MapGroup[]; depthPins: Record<string, number> /* stationKey -> count of doors+pins at current depth */; current: string | null; scope: Scope; onJump: (stationKey: string) => void; onScope: (s: Scope) => void; ariaLabel: string /* ui.reader.ayahs_title */ }`. Beads are flex children with `flex-grow = max(1.4, sqrt(text.length)/3.2)`, min 24px wide, 32px tall, ayah number inside. Above each passage a 4px rail tinted by `color-mix(var(--accent) 16/30/44%, var(--surface-2))` (rail is a button that sets passage scope when the surah has passages; plain otherwise). Under each bead, pins: 6px dots (round for stops, 45deg square for depth items), animated in/out. `aria-current="true"` on the bead of the station crossing the middle of the viewport (IntersectionObserver with `rootMargin: -38% 0 -52% 0`, no scroll listener). Sticky with blur, `prefers-reduced-transparency` fallback. The strip and DepthDial share one sticky `Console` wrapper.

**ReadingUnitSheet** (client, new; replaces the prototype's ScopePicker). Purpose: choose what to read. Opened from the reading-unit button in SurahHeader. A bottom sheet with: (1) one ayah (list of ayah numbers with text previews, `AyahText`), (2) a range (start and end pickers, ayah numbers only, validated start <= end, filtered to the current surah's own ayahs because `surah.ayahs` also holds cross-surah ayahs), (3) a passage (titles and ranges from `surah.passages`), (4) the whole surah. Props: `{ surah: Surah; scope: Scope; ui: Ui; onChoose: (s: Scope) => void; onClose: () => void }`. `type Scope = { kind: "surah" } | { kind: "passage"; id: string } | { kind: "range"; from: number; to: number } | { kind: "ayah"; key: string }`. **Semantics (research): choosing a unit is navigation and focus, not a filter.** It scrolls the thread to that place, dims what is outside it (to .55, not .3, text stays readable), starts the hero question at the first stop at or after it, and shows the unit in the header button. It never removes content, and Next/Previous in the scene keep walking the whole level in order. At the last stop of a passage, NextCard shows the next passage's title and range as an explicit continuation, plus a return-to-overview action. Tapping an ayah medal also opens this sheet pre-set to that ayah (tap an ayah number, then choose range start/end). Clear = choose whole surah. Labels: whole surah uses the surah name; passages use `ui.reader.passages_title`; ayahs use `ui.reader.ayahs_title`; a word for "range" and for "read" are missing from `ui.ar.json` (Q8). Not in v1: saved daily portion, Juz and other canonical divisions (no boundary data, no coverage data) (research, left out).

### 3.2 Hero and thread

**HeroQuestion** (client). Purpose: the invitation: the question of the first stop at or after the chosen reading unit, large, on the dark stage card, with its source chips and a round go button. Props: `{ stop?: MapStop; ui: Ui; onOpen: (s: MapStop) => void }`. Text from `stop.title`. Crossfades (200ms) when the title changes (depth or reading unit). Hidden when no stop. Replaces: `GlanceCard` for depth 0 (GlanceCard stays for the scene body at depth 0 if one stop only).

**SurahThread** (client). Purpose: the map. Props: `{ map: SurahMapModel; ui: Ui; visited: ReadonlySet<number>; scope: Scope; currentStop: number | null; onOpen: (s: MapStop) => void; onScope: (s: Scope) => void; animate: boolean }`. Renders `map.groups` in order: optional PassageBar then AyahNodes (PassageOverview first for a long multi-passage surah). Draws the vertical thread (order of ayahs only: it implies no relation between stops) (2px, `--line-strong`, accent fill as it scrolls into view via `animation-timeline: view()`). Replaces: `surah-map.tsx` (keep its focus-return and scroll-into-view behavior: `enterStation`, restoring focus to the current stop).

**PassageBar** (client). Purpose: a chapter marker on the thread with the passage title (`group.passage.title`), ayah range `numeral(from) - numeral(to)`, **its own SourceMarker** (the passage titles are carried by `passage.records`, so the title is a sourced claim: render `SourceMarker` from `passage.records.map(id => records[id])`), and a round play button that sets passage scope (opens nothing, scrolls and dims). Props: `{ passage: Passage; records: SourceRecord[]; selected: boolean; ui: Ui; onScope: () => void; onOpen: (r: SourceRecord[]) => void }`. State: `aria-pressed`. Surahs without `passages` (Al-Kawthar) get no PassageBar: one whole-surah container, never invent passages (research). Replaces: `map-passage-button` (the current one is a disclosure that collapses a passage; v1 here expands all (ج, see Q6)).

**PassageOverview** (client, new). For long surahs: the thread opens on this outline (research: "surah overview -> approved passages -> stops within the active passage"), the reader may start at any passage and always return to it. Compact vertical rows: passage title, `numeral(from) - numeral(to)`, its SourceMarker, the active one expanded to show its stops' titles as doors. Props: `{ groups: MapGroup[]; records: Surah["records"]; active: string | null; ui: Ui; onPick: (passageId: string) => void; onOpen: (r: SourceRecord[]) => void }`. Do not render hundreds of ayah stations as equal nodes: for a surah with more than ~12 ayahs per passage collapse ayahs without stops into a single row. MiniStrip stays as the compact version of the same overview (semantic zoom: surah, passage, stop; the depth dial is a separate control, never combined with it). The two shipped short surahs do not prove long-surah behavior: validate on a real long surah before locking this (research).

**AyahNode** (client). Purpose: one knot: medal with the ayah number, the ayah in `--text-verse`, and its doors. Props: `{ station: MapStation; scope: Scope; onScope: () => void; onOpen: (s: MapStop) => void; visited: ReadonlySet<number>; children?: ReactNode /* depth pins */ }`. The medal is a button (`aria-pressed` when ayah scope) with `aria-label` = `ui.reader.ayahs_title` + number. Door branch: 2px accent line and a 10px dot from the thread to each door. Dims when out of scope.

**StopDoor** (client). Purpose: one stop on the thread. Props: `{ stop: MapStop; seen: boolean; ui: Ui; onOpen: (s: MapStop) => void }`. Shows `stop.title` (`--text-door`), source chips from `stop.icons`, a forward chevron, a small dot when seen. Reveal/hide on depth change: wrapper `display:grid; grid-template-rows: 1fr` to `0fr` with opacity (320ms), keyed by `stationKey + title` so doors that appear at two depths stay put and only new ones animate in (stagger at most 30ms, first 6 only). A door never previews an answer (no auto-extracted "short answer", no question-only teaser that hides its answer): it shows the question as written and neutral metadata only. Variant `depth` (dashed border, 3-line clamp) for DetailsPin **[needs lib]**; a clamped depth title is acceptable only because the full title is the first thing in the opened item, never a substitute for it.

**DetailsPin / SectionDoor** **[needs lib]** (see 5.4 and Q3). At depth 3 the data has no titled paragraphs, only `details` blocks and headings, which today land in `unassignedBlocks`. The prototype hangs each `details` item from the earliest ayah that its title records' `ayah_keys` point to (record data, not model inference), and shows untitled sections (heading + paragraphs) as doors on a shelf after the last ayah. A pin opens its section scene with that `details` item open. This is a derivation `map.ts` does not do. Proposal (ج): add it as a separate pure function `deriveDepthItems(surah, depth)` next to `deriveSurahMap`, with tests, and only after the owner approves the anchoring rule (Q3).

### 3.3 Scene and reading primitives

**StopScene** (client). Purpose: focused scene. Props: `{ stop: MapStop; previous?: MapStop; next?: MapStop; nextPassage?: Passage; nextSurah?: SurahSummary; ui: Ui; onNavigate: (s: MapStop) => void; onBack: () => void } & ReadingProps`. Layout: top bar (back button `ui.reader.back`, progress pips for the stops of the level, prev/next round buttons with `aria-label` `ui.reader.previous_stop` / `ui.reader.next_stop`), AyahStage, kicker (passage title) and title (the question, shown together with its answer: never a question whose answer is hidden or must be guessed), the stop's text via ClaimText and RelationCards, StopSources, then NextCard. Slides in from below (320ms); stop to stop slides horizontally. Focus moves to the title (`tabIndex={-1}`) on each stop (existing behavior, keep). Esc and browser Back = back to the map. Replaces `stop-scene.tsx`; keep its focus and scroll logic.

**AyahStage** (client when more than 3 ayahs). The dark gradient block with the stop's ayahs (`stop.ayahKeys`) in `--text-stage`, each followed by a ring number gem (`numeral(no)`). More than 3 ayahs: show one with number chips to switch (chips are 44px round buttons, `aria-pressed`). Replaces: `scene-pinned-ayahs` / `ContentBlock type="ayah"` in the scene.

**ClaimText** (server; contains `Pulse` as its stacked variant). Purpose: render one `ParagraphBlock`'s `segments` in their original order. **Decision on pulses (research changed my prototype):** my prototype split every paragraph into one row per `mark`-terminated run with a rail. The research warns against a prose wall in cards and against putting every sentence in its own container, and notes that one marker often closes several sentences (a source boundary is the `mark`, not the full stop). So:

- **Default = flow:** one `<p>` of continuous prose. Segments render inline in order; each `mark`-terminated run is wrapped in a `<span data-run>` (no visual box). The text is fully selectable and reads as natural Arabic prose.
- **Pulses (stacked rows) only when all are true:** role is `claim`, the paragraph has 3 or more `mark`-terminated runs, and its text is longer than about 400 characters (the dense list-of-claims paragraphs, for example the ones that open the understanding level of Al-Duha). Each pulse is a plain block with 8px gap, a 3px inline-start rail tinted by the first icon of the mark's first record, no card, no background. The boundary is only the `mark` segment; never split on full stops with a regex and never invent per-sentence attribution (a punctuation run that starts the text after a mark moves in front of that mark purely for typography, and is dropped after a quote or ayah block).
- **Never split:** `transmission` paragraphs (quoted narration is shown as is), inner paragraphs of `details`, titles, paragraphs with fewer than 3 runs.
- A reader-level switch (flow or pulses) belongs in ReadingPreferences (later); the default is decided by the rule above.
- Keep the claim-ending trick (marker glued to the last word via `splitLastWord`) in both modes so a marker never sits alone at the start of a line (research detail 5; also no clipped diacritics, no breaks inside a word).
- While a SourceSheet is open for a run, that run's `<span data-run>` gets a 200ms highlight (`--accent-soft` background) and is restored to the same scroll position and focus when the sheet closes (research detail 8).

Props: `{ block: ParagraphBlock; mode?: "auto" | "flow" | "pulses"; activeRun?: string | null; ui: Ui } & ReadingProps`. `lib/pulses.ts` exports `toRuns(segments: Segment[]): Segment[][]` (pure, tested; split after each `mark`; a final run without a mark is returned as is) and `shouldStack(block, runs): boolean` implementing the rule above. Punctuation matching uses `\p{P}` or `\u` escapes, no Arabic literals. Replaces: the paragraph rendering inside `ReadingSegments`/`ContentBlock` (the segment-to-node loop stays).

**InlineAyah** (server). An ayah quoted inside the explanation: block, centered, `--text-inline-ayah`, tinted with `ui.icons.ayah.color` (11% surface mix, 28% border), reference line `numeral(surah):numeral(ayah)` in `--text-label` (research: isolate the numeric reference, `dir="ltr"` or a `<bdi>` around the digits and colon so it never reorders). Props: `{ ayah: Ayah; ui: Ui }`. Replaces: `AyahText inline`. Visually distinct from a term and from a citation: the ayah is a block, the term is an underlined word, the citation is a chip.

**VerbatimQuote** (server). A `quote` segment: block, `--font-quote` at `--text-quote`, `--surface-2`, 4px inline-start border, and the following `mark` rendered inside its end. Props: `{ text: string; marker?: ReactNode }`. Never alter the text. Replaces: `q.verbatim` (keep `<q>`/`<blockquote>` semantics; `data-record` stays).

**TermLink** (client). A `term` segment: accent, 600, 2px dotted bottom border (a subtle underline, distinct from the chip of a citation; text selection must still work). Props: `{ term: string; record: SourceRecord; ui: Ui; onOpen: (records: SourceRecord[]) => void }`. `aria-label` = `ui.reader.open_term` + term; `aria-haspopup="dialog"`. Opens SourceSheet in term mode: a short sheet with the term as the title and `record.claim` as the definition, and one button `ui.panel.source` that reveals the evidence in the same sheet (research: compact definition first, source on request). Replaces: `button.reading-term`.

**SourceMarker** (client). The marker after a claim: chips for the union of icons plus a badge pill for `la_yathbut`/`khilaf_mutabar`. Props: `{ records: SourceRecord[]; ui: Ui; onOpen: () => void }`. `aria-label` composition from existing `Marker` is good, keep it. Hover lifts the chips 2px; press scales .92. Replaces: `marks.tsx` `Marker` (keep `Icon` and `Badge`, restyled).

**SourceSheet** (client). The source panel as a bottom sheet, one sheet at a time (never nested). Props: `{ records: SourceRecord[]; ui: Ui; term?: string; onClose: () => void }`. Title `ui.panel.title` (or the term). Order inside a record (research): (1) `ui.panel.claim` + the exact claim, (2) any status or qualification: the badge pill with `ui.badges.<k>.label` and its `meaning`, or `ui.panel.no_badge` when `badge` is null, then `status_text` split by newline, (3) per evidence: `ui.panel.source` (source_title), `.author`, `.locator`, (4) the evidence quote (`ui.panel.quote`, `--font-quote`, inline-start border in the evidence icon's color), (5) rulings (`ui.panel.ruling`; each shows `text` and `ui.panel.ruler`: ruler; **do not show `where`**, it is a raw system string), (6) link strength (`ui.link_strength.<key>` plus `ui.link_strength.note`; `unrated` is shown as `ui.link_strength.unrated`, never upgraded), (7) the `url` as a button-link `ui.panel.open_source` only when `url` is not null (`target="_blank" rel="noopener noreferrer"`); a null url never hides the citation. Several records: first open, the rest in collapsed `details` showing their claim clamped to 2 lines, each individually inspectable. Close button `ui.panel.close`. Behavior: Esc, scrim and the browser Back button close it (push a history entry on open); `max-height: 85dvh`; focus moves to the close button and returns to the opener; background inert; body scroll locked; reading position and the supported run are restored on close; open and close take 200ms. Replaces: `source-panel.tsx` (it already uses native `<dialog>` with correct focus return and a Tab trap; keep that behavior if Radix Dialog is not adopted, see 4).

**DetailsItem** (client). A `details` block: the title segments (text + term + mark) carry the short answer and stay fully visible (no clamp), plus/minus indicator, closed by default, the body (its inner paragraphs, rendered as flow, never pulses) expands inline in 200ms beneath the complete summary. Props: `{ block: Extract<Block, { type: "details" }>; defaultOpen?: boolean } & ReadingProps`. Marks inside the summary must stop propagation so opening the source does not toggle the item. Replaces: `details.reading-details`.

**RelationCard** (server, new, from the research; the signature component). Purpose: show how two ayahs connect, from an explicit source record, never inferred. Layout: the two ayahs stacked (the earlier ayah first, each `InlineAyah`-style with its number), joined by a quiet brace (a bracket drawn with borders on the inline-start side, no arrowhead and no causal arrow), then the record's exact `claim` and its `SourceMarker`. Tapping an ayah reference briefly highlights that ayah in the thread/stage (200ms). Props: `{ record: SourceRecord; ayahs: [Ayah, Ayah]; ui: Ui; onOpen: (r: SourceRecord[]) => void }`. **Eligibility (all required)**: the record's `icons` contains `link`; its `ayah_keys` filtered to this surah's own ayahs are exactly two; the record is cited by a `mark` in the active level (the level's blocks) and `record.depth_min <= depth`; the full claim and source stay reachable. A record listing many ayahs (for example one that lists all eleven) is never expanded into pairs. Placement: after the paragraph (ClaimText) that cites the record. Data in the shipped content (Al-Duha, all `link`, Ibn Kathir, `link_strength` is `unrated`, `depth_min` 2): `93-r096` (ayahs 9 and 6), `93-r102` (10 and 7), `93-r109` (11 and 8). They are cited at depth 2 by the stop whose title asks how these ayahs relate to the three blessings, and at depth 3 inside three `details` items. Show `unrated` link strength as the sheet shows it, never as strong. A lib helper `relationRecords(surah, depth): SourceRecord[]` (pure, tested) finds them. Not an edge between stops: it is the only place the UI draws a relation.

**StopSources** (client, new). A standalone 44px+ button at the end of a scene that opens SourceSheet with all `stop.recordIds` (research: inline markers are small, so offer one comfortable stop-level action). Props: `{ records: SourceRecord[]; ui: Ui; onOpen: (r: SourceRecord[]) => void }`. The Arabic label for "sources of this stop" is not in `ui.ar.json` (Q8): use `ui.panel.title` as the visible text meanwhile.

**NextCard** (client). The onward invitation, never auto-advancing. Props: `{ next?: MapStop; previous?: MapStop; nextPassage?: Passage; nextSurah?: SurahSummary; onNext; onPrevious; onBack; ui: Ui }`. Big accent card with `ui.reader.next_stop` small label and the next stop's title; secondary pills `ui.reader.previous_stop` and `ui.reader.map_view` (return to the map or passage overview is always available). At the last stop of a passage the card shows the next passage's title and range (`PassageContinuation`) as an explicit choice. Last stop of the surah: `ui.reader.next_surah` + surah name linking to `/s/[no]`. `ui.reader.why_next` exists but there is no data behind it: do not use. The prototype's "deeper on this stop" pill (jump to the same stop at the next depth) is **removed from v1** (research: no reviewed cross-depth mapping; see Q5). Replaces: `scene-navigation` / `scene-neighbour`.

**ContinuousView** (server or client). The whole level as one page (`map.continuousBlocks`), for `ui.reader.read_continuous`. Question headings before titled paragraphs, ClaimText, DetailsItem accordions. Props: `{ blocks: Block[] } & ReadingProps`. Replaces: the continuous branch in `Reader` using `ContentBlock`.

**ViewToggle** (client). Two-state segmented control: map (`ui.reader.map_view`) / continuous (`ui.reader.read_continuous`), `aria-pressed`. Replaces: `reader-view-switch`.

### 3.4 Chrome

**AskBox**: keep as is functionally (`components/ask-box.tsx`, `lib/ask`); restyle with the tokens and the SourceSheet for answers. Uses `ui.ask.*` (note: `Ui` type in `types.ts` does not declare `ask`, `AskBox` uses an extended type; keep it consistent). **Disclosure**: footer with `ui.disclosure.ai/scripture/limits` and `ui.privacy_line`, 13px `--ink-3`. **Offline**: unchanged. **EmptyState**: `ui.reader.empty_level` in a quiet note. **LoadingSkeleton**: shimmer blocks matching header/hero/thread shapes (the content is static JSON, so only needed for client navigation). **ErrorState**: icon-only retry with English `aria-label` (no Arabic label exists; add `ui.reader.retry`, see Q8).

**ReadingPreferences** (client, later phase, from the research). A sheet with independent size controls for the Quran text and the explanation text, theme (system, light, dark) and reduced motion. Props: `{ prefs: ReadingPrefs; onChange: (p: ReadingPrefs) => void; ui: Ui }`, stored in `localStorage` (try/catch). Sizes drive `--text-quran-scale` and `--text-body-scale` multipliers on the tokens in 1.2. Labels are missing in `ui.ar.json` (Q8). Enlarged text must keep every component intact (dial wraps, long titles wrap, nothing is clipped). Test full diacritics, waqf marks, the salla-Allah-alayhi-wa-sallam sign, ayah numerals, and copy/paste of Quran text.

## 4. Primitives (what to build on)

Proposal (ج): shadcn/ui (copied into `components/ui/`, Radix underneath, Tailwind 4 and React 19 supported). Wire with `pnpm dlx shadcn@latest init` then `add` per component (do not install in this task; the coding lane runs it).

| Our component | Build on | Notes |
|---|---|---|
| SourceSheet, LegendSheet | shadcn `Sheet` (Radix Dialog) with `side="bottom"`, custom top radius 26 | Only the bottom side is used, so the left/right slide animations that shadcn ships do not matter. Add the grabber bar and close button ourselves. Swipe-to-close would need `Drawer` (vaul): verify its RTL behavior before adopting. Our native `<dialog>` in `source-panel.tsx` also works; choose one, not both. |
| DepthDial | Radix `RadioGroup` (shadcn has it) styled as notches, plus our thumb | `ToggleGroup type="single"` is the alternative, but a radio group is the correct semantics for a single mandatory choice. Wrap the app in Radix `DirectionProvider dir="rtl"` so arrow keys follow RTL. |
| ViewToggle | shadcn `ToggleGroup` (single) or two buttons with `aria-pressed` | Do not use `Tabs`: nothing here is a tabpanel. |
| DetailsItem | native `<details>` (existing, accessible, no JS) or shadcn `Accordion type="multiple"` | Use Accordion only if you need height animation (`--radix-accordion-content-height`). Native is acceptable. |
| PassageBar group (if collapse is kept) | shadcn `Collapsible` | Only if Q6 keeps collapsing. |
| Buttons (pill, round, primary, ghost), SourceChip, Badge | shadcn `Button` and `Badge` with our variants | Add variants `pill`, `round`, `primary` (accent), `quiet`. Size `lg` is 44px. |
| TermLink, SourceMarker, StopDoor | plain `<button>` | no primitive helps; style with tokens. |
| Scroll areas | native scroll | do not use `ScrollArea` (custom scrollbars hurt mobile momentum and our scroll-snap/IO). |
| Tooltip | not used | touch-first; terms open a sheet instead. |
| Toast | not used in v1 | |

Not available as primitives, written by us: SurahThread (thread line, branches, scroll-driven draw), MiniStrip (proportional beads, pins, IO tracking), ClaimText and `toRuns`, AyahStage, HeroQuestion, StopDoor reveal (keyed grid-rows reconciliation), DepthDial thumb.

RTL checklist when copying shadcn components (it is written for LTR; verify, I did not run the CLI):
1. Wrap `<html dir="rtl" lang="ar">` (already) and Radix `DirectionProvider`.
2. Search the copied files for `left`, `right`, `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `slide-in-from-left/right`, `rotate-` on chevrons and replace with logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `start-`, `end-`), flipping chevron meaning by hand.
3. Check whether the current shadcn CLI offers an RTL option; if it does, use it, otherwise do the conversion by hand once and commit.
4. Tailwind `data-[side=...]` variants for Sheet are physical; we only use `bottom`.
5. Focus rings: replace shadcn's default ring color with `--accent` and 3px width.

## 5. File structure (proposal, nothing is deleted by this document)

```
app/src/
  app/                    routes only: layout.tsx, page.tsx, s/[no]/page.tsx, api/ask/route.ts, not-found.tsx
  styles/
    tokens.css            sections 1.1-1.5 (:root, dark, reduced-motion)
    theme.css             @import "tailwindcss"; @theme inline {...}
    reader.css            the few rules Tailwind utilities do not express well: thread line,
                          scroll-driven draw, door grid-rows transition
  components/
    ui/                   shadcn copies and our primitives: button, badge, sheet, radio-group,
                          toggle-group, icon (Hugeicons wrapper), source-chip
    reader/               surah-header, surah-switcher, reading-unit-sheet, depth-dial, mini-strip,
                          hero-question, surah-thread, passage-bar, passage-overview, ayah-node,
                          stop-door, stop-scene, ayah-stage, claim-text, relation-card, inline-ayah,
                          verbatim-quote, term-link, source-marker, source-sheet, stop-sources,
                          legend-sheet, details-item, next-card, continuous-view, view-toggle,
                          reading-preferences, reader (the orchestrator)
    chrome/               disclosure, offline, empty-state, error-state, loading-skeleton
    ask/                  ask-box (+ its parts)
  lib/
    content.ts, types.ts, numerals.ts, map.ts (+ test)   unchanged
    runs.ts (+ test)      toRuns, shouldStack (ClaimText)
    relations.ts (+ test) relationRecords (RelationCard eligibility)
    depth-items.ts (+ test)   only after Q3 is approved
    ask/                  unchanged
```

Naming: files kebab-case, one exported component per file named in PascalCase (`StopDoor` in `stop-door.tsx`), props type `XxxProps` in the same file, no default exports except Next route files. Tokens only through CSS variables or the Tailwind theme; no hex in components (except none: even source colors come from `ui.ar.json`). `"use client"` only where listed in section 3. Tests beside the file (`*.test.ts`, existing `node --test` runner).

### 5.1 Existing files: proposed fate (suggestions only)

| Today | Proposed |
|---|---|
| `components/reader.tsx` (202 lines: orchestrator + `AyahText` + `ContentBlock` + `ReadingSegments`) | split: orchestrator stays `reader/reader.tsx`; `AyahText` becomes `InlineAyah` plus `AyahStage`; `ReadingSegments` becomes `ClaimText` + `VerbatimQuote` + `TermLink`; keep `ayahWords` and `splitLastWord` in `lib/` |
| `components/surah-map.tsx` | becomes `SurahThread`, `PassageBar`, `AyahNode`, `StopDoor` |
| `components/stop-scene.tsx` | stays `StopScene`, extracts `NextCard` and `AyahStage` |
| `components/glance-card.tsx` | merge into `HeroQuestion` / scene body at depth 0 |
| `components/marks.tsx` | `SourceMarker` + `ui/source-chip` + `ui/badge` |
| `components/source-panel.tsx` | `SourceSheet` (keep behavior) |
| `components/legend.tsx` | `LegendSheet` |
| `components/ask-box.tsx`, `disclosure.tsx`, `offline.tsx` | move to `ask/`, `chrome/` |
| `app/globals.css` (235 lines), `app/map.css`, `app/ask.css` | fold into `styles/*` and Tailwind utilities; remove `--space-1..8` aliases and duplicate palette aliases |

### 5.2 Rules the coding lane must keep

- `lib/map.ts` derivation and `lib/content.ts` validation are tested: do not rewrite them; extend only through new files.
- No Arabic text in any `.tsx`/`.ts`/`.css` file. Labels come from `Ui`.
- Ayah text only from `surah.ayahs`; hadith and quotes are rendered verbatim from segments, never altered, never styled as the system's own words.
- `where` in rulings is not shown. `status_text` is shown as given.
- Never draw a line, brace or arrow between two things unless a record carries it (RelationCard is the only relation UI). Never filter content by `ayahs` or `passage` tags; they are navigation hints. Never clamp a claim before its qualification. Never upgrade `unrated` link strength.
- No gamification: the "seen" dot is a quiet dot, no counts, streaks, or completion percentages.

### 5.3 State (kept as in `Reader`, plus)

Keep the URL params `d`, `stop`, `view` and the `huda:*` localStorage keys. Add `scope` in state only (not persisted). Visited stops persist as today in memory; persist across sessions only with the owner's approval (privacy line says choices stay on the device, so `localStorage` is allowed). Provide a `ReaderContext` (`ayahs`, `records`, `ui`, `openSource`) so `ClaimText`, `TermLink`, `SourceMarker` do not need prop drilling.

### 5.4 What the current app does not give the prototype

1. `details` and headings at depth 3 and their anchoring (3.2, Q3).
2. Group headings (a heading directly followed by titled paragraphs) as a kicker on the following stops: `map.ts` drops them from stops and keeps them in `unassignedBlocks` unless it is a duplicate question. Needs a small extension or a read of `unassignedBlocks`.
3. Counts per depth for the dial: easy from `maps[d].stops.length` plus details count.
4. Passage of a stop: `MapStop.passage` exists and is used.

## 6. Build order (each phase is one coding task with an on-screen acceptance test)

Every phase: `pnpm typecheck` and `pnpm test` stay green; verify visually at 390x844 in light and dark, and with `prefers-reduced-motion`. **The first demo is built on Al-Duha (`/s/93`)**: its three approved passages and its three explicit relations (research). Al-Kawthar (`/s/108`) is the no-passages case.

1. **Tokens and fonts.** Add `styles/tokens.css`, `theme.css`, switch fonts to Amiri Quran, Amiri, IBM Plex Sans Arabic (and keep Readex Pro available for a device comparison, Q4); port `globals.css` onto tokens without changing markup. Accept: `/s/108` renders the current UI in the new palette in both color schemes; Quran text is Amiri Quran; no hex left in components.
2. **Icons and buttons.** Install Hugeicons, `ui/icon.tsx`, shadcn `Button`/`Badge` with variants; replace text arrows and the x. Accept: every control shows a library icon; the legend still shows the six source chips unchanged.
3. **Sheets.** `SourceSheet` and `LegendSheet` on `Sheet`. Accept: tap any marker opens the sheet with claim, qualification, source, author, locator, quote, rulings, link strength, and the open-source button only when a url exists; a term opens its short definition with a source button; Esc, scrim, close button and browser Back close it; focus and scroll position return to the opener and the supported text is highlighted while the sheet is open; with several records the extra ones are collapsed.
4. **Reading primitives.** `lib/runs.ts` + test, `ClaimText`, `InlineAyah`, `VerbatimQuote`, `TermLink`, `SourceMarker`, `DetailsItem`, `ContinuousView`. Accept: `/s/93?d=1&view=text` shows short paragraphs as flowing prose and the dense multi-claim paragraph as stacked pulses with rails; hadith as verbatim blocks that are never split; ayahs as tinted blocks; no marker alone on a line; a depth 3 detail opens inline on tap with its full title visible.
5. **Relation cards.** `lib/relations.ts` + test, `RelationCard`. Accept: on `/s/93?d=2`, the stop asking how ayahs 9 to 11 relate to the three blessings shows three cards, each with two stacked ayahs (6 and 9, 7 and 10, 8 and 11), a brace, the exact claim and a marker whose sheet shows the Ibn Kathir record with link strength shown as unrated; at depth 0 and 1 no card appears; no other record produces a card.
6. **Scene.** `StopScene` with `AyahStage`, progress pips, `StopSources`, `NextCard`, 320ms transitions. Accept: opening a stop shows the stage with ayah numbers, the question with its answer, then the next card; next/previous work by button and nothing advances by itself; Esc and browser Back return to the map; focus lands on the title.
7. **Thread.** `SurahThread`, `PassageBar` (with its source marker), `PassageOverview`, `AyahNode`, `StopDoor` (static, depth 1 and 2). Accept: `/s/93` opens on the three passages (titles and ranges as outline rows), expanding one shows its ayahs and doors; no line connects two doors; `/s/108` shows one container with no invented passage; returning from a scene restores scroll and focus to the door.
8. **Depth and strip.** `DepthDial` (no counts by default), `MiniStrip`, keyed door reveal. Accept: switching depth adds and removes doors in place (200-320ms, none under reduced motion); beads show one pin per stop; tapping a bead scrolls to its knot; the dial works with arrow keys in RTL; changing depth with a scene open returns to the map; enlarged text wraps the dial.
9. **Header, reading unit, hero.** `HeroQuestion`, `SurahHeader` with `SurahSwitcher` and the reading-unit button, `ReadingUnitSheet`, `ViewToggle`. Accept: the first screen shows the surah name, the unit button, the hero question and the strip; the sheet offers ayah, range, passage and whole surah (`/s/93` shows three passages), choosing one scrolls and dims without hiding any text, the header button names the choice, the last stop of a passage offers the next passage; the surah chips navigate all four surahs in `index.json`.
10. **Depth 3 on the map** (only after Q3). `lib/depth-items.ts` + test, `DetailsPin`, shelf doors. Accept: at depth 3 on 108 the details hang under ayahs and opening one lands in its section with that item open.
11. **Polish.** `ReadingPreferences`, `AskBox` restyle, `Disclosure`, empty/loading/error states, axe-style contrast and keyboard pass, 390 and 1280 screenshots, remove old CSS and files listed in 5.1 (with the owner's consent for deletions).

## 7. Open questions for the owner

- **Q1.** Approve Hugeicons (free tier) as the single icon library for the interface? (Names in section 2 are unverified until installed.)
- **Q2.** Do you want the six source-type symbols (the text glyphs and their colors) kept as they are, or replaced by library icons in shaped chips (section 2.1)? This is part of your decision on the markers.
- **Q3.** At depth 3 there are no titled stops. May the map hang each `details` item from the earliest ayah that its source records point to (`ayah_keys`), and show the untitled sections on a shelf? Otherwise depth 3 stays a continuous page as it is now.
- **Q4.** Adopt the ink-teal palette and IBM Plex Sans Arabic + Amiri Quran type in place of today's grey palette and Readex Pro? (The research suggested a warm-paper palette with teal and Amiri for the body; I kept cool neutrals. Compare on a device before locking, including Amiri for the explanation text.) **Q4b.** Show the number of doors above each depth name, or no numbers (the research says no numbers; default off)?
- **Q5.** Allow a "deeper on this stop" jump to the same stop at the next depth? Off in v1: it needs a reviewed cross-depth mapping, which the data lacks.
- **Q6.** Passage bars: expand all with scope (proposed), or keep today's collapse-a-passage behavior?
- **Q7.** Desktop: centered reading column only (proposed), or a two-pane layout later?
- **Q8.** Missing labels in `ui.ar.json`: retry, "range", "read this passage", "sources of this stop", reading preferences (text size, theme). Add them? Until then the controls are icon-only with English `aria-label`, or reuse `ui.panel.title`.
- **Q9.** Reading unit: confirm that selecting an ayah or range is navigation and focus only (it never hides text), because the content's ayah and passage tags are not complete scope. A real "lesson for this range only" needs reviewed scope metadata (stable stop IDs, scope, required context) added to the content.

## 8. What was taken from the UI research and what was left

Taken: the "thread of meaning" concept (close to this prototype) with continuous explanation inside passages; RelationCard (two ayahs above one sourced claim) and the Al-Duha first demo; meaningful structural variety instead of identical cards; reading-unit button and sheet (ayah, range, passage, whole surah); long surahs open on a passage outline with return to it; no semantic line without a record; no locked routes, no rank ladder, no numbers or time promises on depth; no clamping a claim before its qualification; no naive filtering by ayah or passage tags; sheets ordered claim, qualification, source, quote, rulings, link strength, url; term sheet short with source on request; one sheet at a time with Back support; highlight of the supported text and exact return; motion 160-220ms for state only and no continuous animation; marker never alone on a line; term distinct from citation; dark mode with its own colors; 24px target-size reading of WCAG 2.2 with 44px standalone controls and a stop-level sources button; independent text-size controls; first demo on Al-Duha.

Changed in my prototype because of it: sentence-per-row pulses are no longer the default (flow by default, stacked only for dense multi-claim paragraphs, boundaries only at `mark`); the ripple animation and per-pulse stagger are removed; motion durations shortened; depth counts off by default; "deeper on this stop" removed; scope no longer limits Next/Previous or hides content.

Left out, with reasons: the lens (concept-map) concept and a global graph (needs relation data that does not exist); the illustrated-atlas concept (illustrations risk carrying interpretation); saved daily portion and Juz divisions (no boundary or coverage data, and no labels); an opening region of reviewed introduction blocks (no designated opening metadata in the content yet); cross-depth stop identity and exact range lessons (need reviewed metadata, listed in Q9); the research palette (warm paper family) because it is the beige family I avoid as a default, pending Q4.
