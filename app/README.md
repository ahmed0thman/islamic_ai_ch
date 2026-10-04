# Huda reader

Arabic, RTL, mobile-first static Quran reader. It renders prepared content only.

Requires Node.js >=20.9 and pnpm 10.26.1. From the repository root:

```sh
cd app
pnpm install
pnpm dev
```

The local `.npmrc` enables pnpm's pre/post script hooks. `predev` and `prebuild`
copy `../content/ui.ar.json` and `../content/export/*.json` byte-for-byte into
ignored `src/content/`. The same hook derives the manifest's Arabic strings from
the UI dictionary. Source content is never modified. To sync manually:

```sh
pnpm sync-content
pnpm typecheck
```

Build the static site:

```sh
pnpm build
```

Deploy the contents of `out/` at the host root, preserving directory indexes and
all `_next` assets. There is no Node server in production. For a local production
preview, use an existing static HTTP server (for example, Python):

```sh
python3 -m http.server 4173 --directory out
```

`generateStaticParams` validates each indexed surah and its references at build
time. All four depth levels are bundled in each reader page. A valid `?d=0..3`
wins over the local device preference; the default is 1. Storage denial is safe.

`next/font/google` uses Noto Naskh Arabic for prose and Amiri Quran for Quran
text. **The first dev run or production build needs network access to fetch the fonts.**
They are then self-hosted and precached. Quran text is rendered unchanged,
including source marks, with a separate numeric ayah indicator. Inspect the real
Uthmani dataset's full diacritics and special marks on target devices before
release; font coverage and visual fidelity cannot be verified from this fixture.

The production-only hand-written service worker precaches every exported page,
router payload, asset, and font on the first successful online visit. `postbuild`
generates its cache version from output bytes. Offline readiness requires a
completed installation; use HTTPS or localhost. An updated worker waits for
existing tabs to close, avoiding mixed editions. Content updates require a new
build. No analytics, external client font requests, or remote content fetching.
Source links open only when requested by the reader.

All design tokens are at the top of `src/app/globals.css`, including a dark theme
via `prefers-color-scheme`. Source icons keep their supplied shape and color;
dark mode lifts the colors for legibility. No UI kit or state library.

Written without installing packages, contacting the network, or starting a
server. Run the commands above to verify TypeScript, build, focus/keyboard and
RTL layout, real font rendering, narrow screens, both themes, and offline reload.
