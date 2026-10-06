# Huda reader

Arabic, RTL, mobile-first Quran reader. It renders prepared content. The root [`README.md`](../README.md) has the short setup, the judge's key instructions and the repository map; every environment variable is listed in `.env.example`; the detailed setup, re-test and clean-clone results are in the Arabic section at the end of this file.

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
assistant and adaptive weaving; `pnpm start`); see the last section and `render.yaml`
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

Verified on 5 October 2026: `pnpm typecheck` and `pnpm test` pass (see the last section).
Real font rendering, narrow screens, both themes and offline reload still need checking
on target devices.

<div dir="rtl">

## التشغيل من نسخة نظيفة وإعادة الاختبار (منقول من `README.md` الجذر)

نُقلت هذه التفاصيل من الملف الجذر حين أُعيدت كتابته لزائر المستودع والمحكّم. وهي نتائج جلسة سحابية جرّبت الأوامر في **5 أكتوبر 2026 (نحو 23:00 بتوقيت القاهرة)** **من نسخة بلا `.cache/`**، وبلا `node_modules`، وبلا `app/.env.local`، على الالتزام `1fb88f0`. الإصدارات: node 22.22.2، وpnpm 10.33.0، وبايثون 3.11.15. التفصيل في [`docs/08-open/cloud-reports/s-01-clean-clone.md`](../docs/08-open/cloud-reports/s-01-clean-clone.md). ولم تُعاد التجربة بعدها، وعدد السور المنشورة وعدد الاختبارات تغيّرا منذئذ.

### المتطلبات

- **node:** لم يفشل شيء بسبب الإصدار 22.22.2، فلا يلزم 24. والحد الأدنى في `package.json` هو 20.9.0، لكن `pnpm test` يشغّل ملفات `.ts` مباشرة بلا علم، وهذا لا يتوفر في خط 22 قبل 22.18.0 بحسب `CHANGELOG.md` المرفق مع node 22.22.2 (قُرئ ولم يُجرَّب إصدار أقدم). ويثبّت `render.yaml` الإصدار 24.16.0 للنشر.
- **pnpm:** داخل `app/` يقرأ حقل `packageManager` (`pnpm@10.26.1`) فينزّل ذلك الإصدار من الشبكة بصمت في أول مرة، ثم يشغّل التثبيت به.
- **بايثون 3** لأدوات `tools/`.
- **بوستجرس 18 مع pgvector** لاسترجاع «اسأل» وحده. لم يُجرَّب في الجلسة السحابية (ليس فيها بوستجرس ولا مفاتيح).
- **الشبكة:** جلب `pnpm build` الخطوط من الشبكة ونجح (المستودع لا يحوي ملف خط `woff2`). ولم يُجرَّب البناء بلا شبكة.

### التثبيت والتشغيل

```bash
cd app
pnpm install                   # نجح: 481 حزمة، في نحو 14 ثانية على مخزن حزم فارغ
cp .env.example .env.local     # عبّئ ما تحتاجه فقط؛ كل القيم فارغة افتراضيًّا، ونجح كل ما جُرّب بدونه
pnpm dev                       # قارئ ثابت على http://localhost:3000، وقبله تُنسخ ملفات المحتوى تلقائيًّا
```

- يطبع التثبيت تحذيرًا بأن سكربتات بناء `onnxruntime-node` و`protobufjs` و`sharp` لم تُشغَّل (`Ignored build scripts`، ولتشغيلها `pnpm approve-builds`)؛ ولم يضرّ ذلك شيئًا مما جُرّب.
- **يعدّل `pnpm dev` الملف المتتبَّع `app/next-env.d.ts`** (السطر 3)، فيظهر في `git status`.
- **القارئ وحده** (بلا «اسأل» وبلا قاعدة بيانات): `pnpm build` يولّد مجلد `out/` الثابت، ويُفتح بأي خادم ملفات. جُرّب: نجح في 20 ثانية وولّد 106 ملفات (نحو 8.5 ميجابايت).

### «اسأل» حيًّا

1. أنشئ قاعدة بوستجرس 18 فيها إضافة `vector` (ملف `db/rag.sql` ينشئها)، وضع رابطها في `DATABASE_URL`.
2. `pnpm rag:ingest` يملأ القاعدة بالجمل الموثقة وسجلات السور المنشورة. ويقرأ `.cache/records/<رقم>/records.v2.json` إن وُجد.
3. شغّل `HUDA_ASK=1 pnpm dev`، أو `HUDA_ASK=1 pnpm build && HUDA_ASK=1 pnpm start`. المتغير يلزم وقت البناء ووقت التشغيل معًا.
4. «نسيج لك» يعمل بـ`HUDA_WEAVE=1` بالطريقة نفسها.
5. المفتاح: إما من متغيرات البيئة، وإما **أن يُدخل المحكّم مفتاحه من الواجهة** (ق-088، ق-140، ق-142، ق-144): OpenAI أو Google أو Anthropic لجواب «اسأل»، وGroq للتفريغ الصوتي. يُحفظ في `sessionStorage` ويُرسل في الترويستين `x-huda-provider` و`x-huda-key`، ولا يُخزَّن في الخادم ولا يُسجَّل (`src/lib/own-key.ts`، `src/lib/ask/providers.ts`، `src/app/api/transcribe/route.ts`).
6. السؤال بالصوت يحتاج `GROQ_API_KEY`، أو خادم ويسبر محليًّا بـ`HUDA_VOICE_STT_URL`. والميكروفون لا يعمل إلا على رابط آمن (https) أو على الجهاز نفسه.

جُرّب في الجلسة السحابية (في نسخة منفصلة، بلا قاعدة ولا مفاتيح): `HUDA_ASK=1 pnpm build` نجح، و`HUDA_ASK=1 pnpm start` أقلع، وردّ `/api/health/` بالرمز 200 وبالنص `{"ok":true,"db":false,"embed":"off"}`. وبلا `DATABASE_URL` يتوقف `pnpm rag:ingest` فورًا برسالة `DATABASE_URL is not set`. **ولم يُجرَّب:** «اسأل» نفسه، و«نسيج لك»، والصوت، والمفتاح المُدخَل من الواجهة، وتسجيل الدخول؛ كلها تحتاج قاعدة أو مفتاحًا.

**ما لا يعمل بلا `.cache/`:** `.cache/` خارج git، وفيه نصوص الكتب (لا تُنشر، ق-131) وفهرسها (`.cache/index/sources.sqlite`) وسجلات كل سورة. من نسخة بلا `.cache/`: نجح التثبيت والمزامنة وفحص الأنواع واختبارات التطبيق واختبارات بايثون وفحص حالات السلامة وبناء القارئ الثابت، فالسور المنشورة **تُقرأ**. **وفشل أمر واحد:** `python3 -B tools/export_content.py <أرقام السور> --check-only` يتوقف لكل سورة بالرسالة `INPUT FAIL checked=1 failed=1: [Errno 2] No such file or directory: '<الجذر>/.cache/records/<رقم>/records.v2.json'` ورمز الخروج 1، لأن مجلد السجلات الافتراضي هو `.cache/records`. **ولم يُجرَّب** (مأخوذ من قراءة الكود وحدها): بناء سورة جديدة، وفهرسة الكتب، وملء مقاطع الكتب في القاعدة (`pnpm rag:ingest --passages` يتوقف إن غاب الفهرس). (وصف مفصل: `tools/pipeline/README.md`، القسم 3.)

**النشر:** `render.yaml` في الجذر، وإعادة بناء القاعدة في `scripts/db-rebuild.md`، وإبقاء الخدمة مستيقظة في `scripts/keepalive.md`.

### إعادة الاختبار

**الترتيب مهم:** `pnpm sync-content` قبل فحص الأنواع والاختبارات، لأنهما يقرآن `src/content/` وهو خارج git (`.gitignore`، السطر 4) ويولّده ذلك الأمر. وجُرّب بدونه: فشل `pnpm typecheck` بأخطاء `TS2307: Cannot find module '@/content/ui.ar.json' or its corresponding type declarations` ونظائرها، وفشل `pnpm test` في تسعة ملفات (`ERR_MODULE_NOT_FOUND` عن `src/content/quran-plain.json`، و`ENOENT` عن `src/content/mushaf-index.json` و`src/content/surah-108.json`). (`pnpm dev` و`pnpm build` يشغّلان المزامنة تلقائيًّا؛ فحص الأنواع والاختبارات لا.)

```bash
# التطبيق (من app/)
pnpm install
pnpm sync-content
pnpm typecheck                 # نجح، نحو 9 ثوانٍ
pnpm test                      # نجح في 5 أكتوبر: 265 اختبارًا، 263 نجح، 0 فشل، 2 تخطّاهما

# بايثون (من tools/)
cd ../tools
python3 -B -m unittest test_export_content test_normalize_cases test_retrieve test_fetch_shamela   # نجح: 125 اختبارًا
#   اختبار التصدير يجب أن يُشغَّل من داخل tools/ (من الجذر: ModuleNotFoundError: No module named 'export_content')
cd pipeline && python3 -B -m unittest test_run_surah     # نجح: 41 اختبارًا

# اتساق حالات السلامة بين docs/06-product/safety-test-set.md وtools/data/eval/safety_cases.json (من الجذر)
cd ../.. && python3 tools/check_safety_cases.py          # يطابق بين ملفين ولا يختبر سلوك النموذج
```

**الاختباران المتخطَّيان** يحتاجان قاعدة بيانات: `per-call retrieval mode overrides the environment without mutating it`، و`integration: ingest surah 108 and retrieve atoms and passages` (السبب: `HUDA_TEST_DATABASE_URL is not set`). فلم يُجرَّب اختبار الاسترجاع المتكامل.

**سكربتا التقييم** في `package.json` (لم يُشغَّلا في الجلسة السحابية: الأول يحتاج `DATABASE_URL`، والثاني مفتاحًا أو خادمًا قائمًا):

```bash
pnpm eval:retrieval --split held         # استدعاء@8 و@24 وMRR@10 للأنماط الثلاثة: نصي، ودلالي، وهجين
pnpm eval:ask --direct --surah 93        # أو --base http://localhost:3000 ؛ حالات السلامة، من متغيرات البيئة الموروثة وبلا ملف بيئة
```

نتائج الاسترجاع الأولى في `tools/data/eval/results/` (جدول المجموعة المحجوزة في `retrieval-2026-10-05.md`). وهي تقيس الاسترجاع لا صحة المعنى الديني. وشرح مجموعة القياس في `tools/data/eval/README.md`.

### الخصوصية والإفصاح

- نص الإفصاح يظهر في التطبيق من `content/ui.ar.json`: المفتاح `disclosure`.
- الخصوصية: المفتاح `privacy_line` (اختيارات القارئ على جهازه، ولا نحفظ عنه شيئًا عندنا)، والمفتاح `ask.voice_privacy` (الصوت يُرسل أثناء الكلام إلى خدمة تحويل الكلام إلى نص ولا يُحفظ). وتسجيل الأسئلة مغلق افتراضيًّا (`HUDA_ASK_LOG_QUESTIONS`).

</div>
