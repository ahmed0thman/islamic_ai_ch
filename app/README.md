# Huda reader

Arabic, RTL, mobile-first Quran reader. It renders prepared content. Setup, tests, environment variables and the repository map are in the root [`README.md`](../README.md); every variable is listed in `.env.example`.

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

The default build is a static export: deploy the contents of `out/` at the host root,
preserving directory indexes and all `_next` assets, with no Node server. Setting
`HUDA_ASK=1` or `HUDA_WEAVE=1` at build time builds a Node server instead (the "ask"
assistant and adaptive weaving; `pnpm start`); see the root README and `render.yaml`
(the deployment has not been tried yet). For a local preview of the static build, use
an existing static HTTP server (for example, Python):

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
build. No analytics and no external client font requests. The reader page fetches no remote
content (only the optional server-mode "ask" calls model providers and a database).
Source links open only when requested by the reader.

Sign-in (Clerk) is optional and protects nothing; every route stays public. It
exists only in a server build (`HUDA_ASK=1` or `HUDA_WEAVE=1`) that also has
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `next.config.ts` then sets
`NEXT_PUBLIC_HUDA_AUTH`, which turns on the provider, `src/proxy.ts`, the
`/sign-in` and `/sign-up` pages and the controls in `src/components/account/`.
The static export bundles no Clerk code. Local keys are in `.env.local`
(`npx clerk init`); try it with `HUDA_ASK=1 pnpm dev`. Clerk's screens are in
Arabic (`@clerk/localizations`, with our wording in the `clerk` section of
`content/ui.ar.json`) and take the app's tokens from
`src/components/account/clerk.css`.

All design tokens are at the top of `src/app/globals.css`, including a dark theme
via `prefers-color-scheme`. Source icons keep their supplied shape and color;
dark mode lifts the colors for legibility. Components under `src/components/ui/` come
from shadcn/ui (Radix); icons are Hugeicons. No state library.

Verified on 5 October 2026: `pnpm typecheck` and `pnpm test` pass (see the root README).
Real font rendering, narrow screens, both themes and offline reload still need checking
on target devices.
