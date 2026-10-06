<div dir="rtl">

# هُدًى

شرح عربي مترابط لسور القرآن، مكتوب لقارئ غير متخصص، بأربع درجات عمق: لمحة، ففهم، فتدبر، فتعمق.

- كل دعوى في الشرح تحمل مصدرها وحالتها، وتفتح علامتها المصدر في موضعه.
- الذكاء الاصطناعي ينسج الكلام ولا يولّد معلومة ولا يحكم على رواية (ق-014، ق-048): ما لا يحمله سجل موثق يُحجز ولا يُعرض.
- نص الآية من ملف مجمع الملك فهد وحده (ق-038).
- «اسأل» يجيب من الشرح الموثق ومن مقاطع الكتب باقتباس حرفي منسوب، ويمتنع عن الفتوى (ق-086).
- المشروع مشارك في «تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي» (مؤسسة باذل الأهلية)، والمسار الثالث، ويُقيَّم فيه ما أُنجز من 4 إلى 6 أكتوبر 2026 فقط (انظر «ما سبق التحدي» أدناه).

## خريطة المستودع

| المجلد | ما فيه |
|---|---|
| `app/` | تطبيق القارئ: Next.js 16 وReact 19 وTailwind 4. تصدير ثابت افتراضيًّا، ووضع خادم لـ«اسأل» و«نسيج لك». وفيه `db/` (مخطط بوستجرس)، و`scripts/` (المزامنة والاستيعاب والتقييم)، و`README.md` خاص به. |
| `content/` | المحتوى: `nasij/` (النسيج بأربع درجات)، و`export/` (التصدير العام الذي يقرؤه التطبيق)، و`ui.ar.json` (كل نصوص الواجهة)، و`SCHEMA.md` (شكل الملفات). |
| `tools/` | أدوات بايثون: التصدير والفحوص (`export_content.py`)، والفهرسة والبحث (`build_index.py`، `retrieve.py`)، وجلب الكتب، والتفريغ الصوتي، واختباراتها، وبيانات القياس في `data/eval/`. |
| `tools/pipeline/` | خط المعالجة من المصدر إلى الشاشة: مشغّل بناء السور، وقوالب التكليف، ووصفه الكامل في `tools/pipeline/README.md`. |
| `docs/` | وثائق المشروع: الرؤية، والمنهج، والمصادر، والمنتج، والمسابقة، والمهام المفتوحة. الفهرس في `docs/README.md`، والقرارات في `docs/decisions.md`. |
| `design/` | نماذج التصميم، و`DESIGN.md` (قيم التصميم والمكوّنات)، ومسابقة الواجهة في `bakeoff/`. |
| `presentation/` | شرائح العرض ومشروعها. |
| `references/` | تفريغات دروس التدبر لدراسة **طريقة** المتكلم لا مضمونه، وليست مصدرًا لنص آية أو حديث. |
| `render.yaml` | ملف نشر جاهز على Render. **لم يُجرَّب النشر بعد.** |

## التشغيل من نسخة نظيفة

**ما جُرّب:** في 5 أكتوبر 2026 (نحو الساعة 23:00 بتوقيت القاهرة) جرّبت جلسة سحابية أوامر هذا القسم والقسم التالي (إلا ما كُتب فيهما أنه لم يُجرَّب) **من نسخة بلا `.cache/`**، وبلا `node_modules`، وبلا `app/.env.local`، على الالتزام `1fb88f0`. الإصدارات: node 22.22.2، وpnpm 10.33.0، وبايثون 3.11.15. التفصيل والأزمنة ونصوص الأخطاء في [`docs/08-open/cloud-reports/s-01-clean-clone.md`](docs/08-open/cloud-reports/s-01-clean-clone.md).

**المتطلبات:**

- **node:** جُرّبت أوامر القسمين بالإصدار 22.22.2 ولم يفشل منها شيء بسبب الإصدار (والفاشل واحد لسبب آخر، انظر أدناه)، فلا يلزم 24. والحد الأدنى المكتوب في `app/package.json` (السطر 7) هو 20.9.0، لكن `pnpm test` (السطر 22) يشغّل ملفات `.ts` مباشرة بلا علم، وهذا لا يتوفر في خط 22 قبل 22.18.0 بحسب `CHANGELOG.md` المرفق مع node 22.22.2 (قرأته ولم أجرّب إصدارًا أقدم). ويثبّت `render.yaml` الإصدار 24.16.0 للنشر (السطران 28 و29)، ولم يُجرَّب النشر.
- **pnpm:** المثبَّت عامًّا هنا 10.33.0. وداخل `app/` يقرأ حقل `packageManager` (`pnpm@10.26.1`، السطر 5 من `app/package.json`) فينزّل ذلك الإصدار من الشبكة بصمت في أول مرة، ثم يشغّل التثبيت به، بلا تحذير ولا خطأ.
- **بايثون 3** لأدوات `tools/` (جُرّب 3.11.15).
- **بوستجرس 18 مع إضافة pgvector** لاسترجاع «اسأل» وحده. لم يُجرَّب هنا: ليس في الجلسة السحابية بوستجرس ولا مفاتيح.
- **الشبكة:** جلب `pnpm build` الخطوط من الشبكة ونجح (المستودع لا يحوي ملف خط `woff2` واحدًا، وفي `out/_next/static/media/` خمسة وعشرون منها). ولم يُجرَّب البناء بلا شبكة.

```bash
cd app
pnpm install                   # نجح: 481 حزمة، في نحو 14 ثانية على مخزن حزم فارغ (وفي 2 ثانية حين كانت الحزم فيه)
cp .env.example .env.local     # لم يُجرَّب في الجلسة السحابية (لا يُنشأ فيها هذا الملف) ونجح كل ما جُرّب بدونه؛ عبّئ منه ما تحتاجه فقط، كل القيم فارغة افتراضيًّا
pnpm dev                       # قارئ ثابت على http://localhost:3000، وقبله تُنسخ ملفات المحتوى تلقائيًّا
```

يطبع التثبيت تحذيرًا بأن سكربتات بناء `onnxruntime-node` و`protobufjs` و`sharp` لم تُشغَّل (`Ignored build scripts`، ولتشغيلها `pnpm approve-builds`)؛ ولم يضرّ ذلك شيئًا مما جُرّب. وجُرّب `pnpm dev` في نسخة منفصلة وعلى منفذ آخر (`pnpm dev -p 31071`) بلا `.env.local`: أقلع في أقل من ثانية، وردّت `/` و`/s/93/` و`/s/107/` و`/s/108/` و`/s/112/` و`/manifest.webmanifest` بالرمز 200. **ويعدّل `pnpm dev` الملف المتتبَّع `app/next-env.d.ts`** (السطر 3)، فيظهر في `git status`.

**القارئ وحده** (بلا «اسأل» وبلا قاعدة بيانات): `pnpm build` يولّد مجلد `out/` الثابت، ويُفتح بأي خادم ملفات. هذا هو الوضع الافتراضي. **جُرّب:** نجح في 20 ثانية، وولّد 106 ملفات (نحو 8.5 ميجابايت) فيها صفحات السور الأربع؛ وخُدم `out/` بـ `python3 -m http.server`، فردّت `/` و`/s/93/` و`/s/107/` و`/s/108/` و`/s/112/` بالرمز 200، و`/s/110/` بالرمز 404 (غير منشورة).

**«اسأل» حيًّا:**

1. أنشئ قاعدة بوستجرس 18 فيها إضافة `vector` (ملف `app/db/rag.sql` ينشئها)، وضع رابطها في `DATABASE_URL`.
2. `pnpm rag:ingest` يملأ القاعدة بالجمل الموثقة وسجلات السور المنشورة. ويقرأ `.cache/records/<رقم>/records.v2.json` إن وُجد.
3. شغّل `HUDA_ASK=1 pnpm dev`، أو `HUDA_ASK=1 pnpm build && HUDA_ASK=1 pnpm start`. المتغير يلزم وقت البناء ووقت التشغيل معًا.
4. «نسيج لك» (تكيف النسيج مع القارئ) يعمل بـ`HUDA_WEAVE=1` بالطريقة نفسها.
5. المفتاح: إما مفتاح من متغيرات البيئة (`OPENCODE_GO_API_KEY` أو غيره)، وإما **أن يُدخل المحكّم مفتاحه هو من الواجهة** (ق-088)، فلا يحتاج مفاتيحنا. المفتاح المُدخَل يُحفظ في ذاكرة جلسة المتصفح وحدها (`sessionStorage`) ويُرسل مع كل سؤال، ولا يُخزَّن في الخادم بحسب الكود (`app/src/lib/own-key.ts`، `app/src/lib/ask/providers.ts`؛ قرأتهما ولم أجرّب).
6. السؤال بالصوت يحتاج `GROQ_API_KEY`، أو خادم ويسبر محليًّا بـ`HUDA_VOICE_STT_URL`. والميكروفون لا يعمل إلا على رابط آمن (https) أو على الجهاز نفسه.

**جُرّب من هذا الجزء في الجلسة السحابية** (في نسخة منفصلة، بلا قاعدة ولا مفاتيح): `HUDA_ASK=1 pnpm build` نجح في 20 ثانية، و`HUDA_ASK=1 pnpm start` أقلع، وردّ `/api/health/` بالرمز 200 وبالنص `{"ok":true,"db":false,"embed":"off"}`. وبلا `DATABASE_URL` يتوقف `pnpm rag:ingest` فورًا برسالة `DATABASE_URL is not set` ورمز الخروج 1. **ولم يُجرَّب:** «اسأل» نفسه، و«نسيج لك»، والصوت، والمفتاح المُدخَل من الواجهة، وتسجيل الدخول؛ كلها تحتاج قاعدة أو مفتاحًا.

كل المتغيرات التي يقرؤها الكود مسمّاة ومشروحة في `app/.env.example`.

**تسجيل الدخول (Clerk)** قيد الإضافة: اختياري ولا يحجب القراءة ولا «اسأل»، ويُفعَّل في بناء الخادم وحده (ق-089). متغيراته مذكورة في `app/.env.example`.

**ما لا يعمل بلا `.cache/`:** `.cache/` خارج git، وفيه نصوص الكتب (لا تُنشر، ق-131) وفهرسها (`.cache/index/sources.sqlite`) وسجلات كل سورة. **جُرّب من نسخة بلا `.cache/`:** نجح التثبيت، والمزامنة، وفحص الأنواع، واختبارات التطبيق (265)، واختبارات بايثون (125 و41)، وفحص حالات السلامة، وبناء القارئ الثابت؛ فالسور الأربع المنشورة **تُقرأ**. **وفشل أمر واحد:** `python3 -B tools/export_content.py 93 107 108 112 --check-only` يتوقف لكل سورة بالرسالة `INPUT FAIL checked=1 failed=1: [Errno 2] No such file or directory: '<الجذر>/.cache/records/<رقم>/records.v2.json'` ورمز الخروج 1، لأن مجلد السجلات الافتراضي هو `.cache/records` (`tools/export_content.py`، السطر 792). **ولم يُجرَّب** (فهو مأخوذ من قراءة الكود وحدها: **غير متحقق بالتجربة**): بناء سورة جديدة، وفهرسة الكتب، وملء مقاطع الكتب في القاعدة (`pnpm rag:ingest --passages` يتوقف إن غاب الفهرس)، وسكربتا بناء السجلات وفحصها المشتركان في `.cache/records/108/` (وهما خارج المستودع أيضًا). (وصف مفصل: `tools/pipeline/README.md`، القسم 3.)

**النشر:** `render.yaml` في الجذر، وإعادة بناء القاعدة في `app/scripts/db-rebuild.md`، وإبقاء الخدمة مستيقظة في `app/scripts/keepalive.md`. **لم يُجرَّب النشر بعد.**

## إعادة الاختبار

جُرّبت هذه الأوامر في 5 أكتوبر 2026 **من نسخة بلا `.cache/`** (وبلا `node_modules` وبلا `app/.env.local`)، في جلسة سحابية بإصدار node 22.22.2 وبايثون 3.11.15، بهذا الترتيب. وتأخذ كلها نحو دقيقتين.

**الترتيب مهم:** `pnpm sync-content` قبل فحص الأنواع والاختبارات، لأنهما يقرآن `app/src/content/` وهو خارج git (`app/.gitignore`، السطر 4) ويولّده ذلك الأمر. وجُرّب بدونه في نسخة منفصلة: فشل `pnpm typecheck` بستة أخطاء من نوع `TS2307: Cannot find module '@/content/ui.ar.json' or its corresponding type declarations` ونظائرها، وفشل `pnpm test` في تسعة ملفات اختبار (سبعة منها بـ `ERR_MODULE_NOT_FOUND` عن `src/content/quran-plain.json`، واثنان بـ `ENOENT` عن `src/content/mushaf-index.json` و`src/content/surah-108.json`)، فسُجّل 165 اختبارًا بدل 265. (`pnpm dev` و`pnpm build` يشغّلان المزامنة تلقائيًّا؛ فحص الأنواع والاختبارات لا.)

```bash
# التطبيق (من app/)
pnpm install
pnpm sync-content              # نجح: 17 ملفًا في app/src/content/
pnpm typecheck                 # نجح بلا أخطاء، نحو 9 ثوانٍ
pnpm test                      # نجح: 265 اختبارًا، 263 نجح، و0 فشل، و2 تخطّاهما، نحو 11 ثانية

# بايثون (من tools/)
cd ../tools
python3 -B -m unittest test_export_content test_normalize_cases test_retrieve test_fetch_shamela
#   نجح: 125 اختبارًا (98 + 3 + 18 + 6)، نحو 52 ثانية. اختبار التصدير يجب أن يُشغَّل من داخل tools/ (جُرّب من الجذر بصيغة python3 -B -m unittest tools.test_export_content فجاء: ModuleNotFoundError: No module named 'export_content')
cd pipeline && python3 -B -m unittest test_run_surah     # نجح: 41 اختبارًا، نحو 30 ثانية

# اتساق حالات السلامة بين docs/06-product/safety-test-set.md وtools/data/eval/safety_cases.json (من الجذر)
cd ../.. && python3 tools/check_safety_cases.py          # نجح: OK: 24 cases, same ids and levels in both files (يطابق بين ملفين ولا يختبر سلوك النموذج)

# فحص التصدير نفسه (من الجذر): يحتاج .cache/records، وقد فشل في نسخة بلا .cache/
python3 -B tools/export_content.py 93 107 108 112 --check-only
#   رمز الخروج 1، ولكل سورة سطر مثل: 93 INPUT FAIL checked=1 failed=1: [Errno 2] No such file or directory: '<الجذر>/.cache/records/93/records.v2.json'
```

**الاختباران المتخطَّيان** يحتاجان قاعدة بيانات: `per-call retrieval mode overrides the environment without mutating it` (سبب التخطي: `DATABASE_URL/HUDA_TEST_DATABASE_URL is not set`)، و`integration: ingest surah 108 and retrieve atoms and passages` (`HUDA_TEST_DATABASE_URL is not set`). فلم يُجرَّب اختبار الاسترجاع المتكامل.

**سكربتا التقييم** موجودان في `app/package.json` ولم يُشغَّلا في الجلسة السحابية (الأول يحتاج `DATABASE_URL`، والثاني مفتاحًا أو خادمًا قائمًا):

```bash
pnpm eval:retrieval --split held         # استدعاء@8 و@24 وMRR@10 للأنماط الثلاثة: نصي، ودلالي، وهجين
pnpm eval:ask --direct --surah 93        # أو --base http://localhost:3000 ؛ حالات السلامة، من متغيرات البيئة الموروثة وبلا ملف بيئة
```

نتائج الاسترجاع الأولى في `tools/data/eval/results/` (جدول المجموعة المحجوزة في `retrieval-2026-10-05.md`). وهي تقيس الاسترجاع لا صحة المعنى الديني. وشرح مجموعة القياس في `tools/data/eval/README.md`.

## ما سبق التحدي وما بُني فيه

- الوسم `pre-challenge` على الالتزام `1520f64` (4 أكتوبر 2026، 07:29) هو نسخة البداية (ق-101). قبله: وثائق تخطيط ومنهج ونصوص تسجيل وعرض، وتفريغات الدروس.
- **كل كود التطبيق والأدوات والمحتوى المنسوج بعده.** عدد الالتزامات بعد الوسم عند كتابة هذا السطر: 311. للتحقق: `git log --oneline pre-challenge..HEAD | wc -l`، وللفرق: `git diff --stat pre-challenge..HEAD`.
- هل الوسم مدفوع إلى GitHub: **غير متحقق** (الشبكة ممنوعة عند الكتابة).

## حالة المحتوى بصدق

- **أربع سور منشورة** في القارئ: الضحى (93)، والماعون (107)، والكوثر (108)، والإخلاص (112). وفي `content/export/` اثنتا عشرة سورة مبنية، لكن الباقية غير منشورة (ق-076: عمق لا عرض).
- **كل السجلات حالتها «مرشّحة»:** لم يراجع سجلاتها أو شرحها متخصص بعد. والمراجعة الآلية المستقلة جرت على بعضها، وفي ملف `tools/pipeline/README.md` (القسم 5) نتائجها وما بقي بلا مراجعة ثانية.
- لا نقول إن الشرح خالٍ من الخطأ: «نقلل الخطأ بالفحص ولا ندّعي انعدامه».

## الخصوصية والإفصاح

- نص الإفصاح يظهر في التطبيق من `content/ui.ar.json`: المفتاح `disclosure` (صاغه ذكاء اصطناعي من مصادر مسماة ولم يراجعه متخصص، وما هو نقل يظهر مميَّزًا، وحدود الفحص).
- الخصوصية: المفتاح `privacy_line` (اختيارات القارئ على جهازه، ولا نحفظ عنه شيئًا عندنا)، والمفتاح `ask.voice_privacy` (الصوت يُرسل أثناء الكلام إلى خدمة تحويل الكلام إلى نص ولا يُحفظ). وتسجيل الأسئلة مغلق افتراضيًّا (`HUDA_ASK_LOG_QUESTIONS`).

## المصادر والأدوات والتراخيص

[`docs/07-competition/sources-tools-licenses.md`](docs/07-competition/sources-tools-licenses.md): المصادر المستعملة فعلًا في السور الأربع، والأدوات والنماذج وتراخيصها، وما في المستودع وقد لا نملك حق نشره. **لا ملف `LICENSE` بعد:** الترخيص ينتظر قرار صاحب الفكرة (اقتراح في آخر ذلك الملف).

---

**In English (short).** Huda ("guidance") is an Arabic reader that explains a Quran surah to a non-specialist at four depths. Every claim carries its source and its status; the AI weaves text from verified records and does not generate facts or rule on narrations. Four surahs (93, 107, 108, 112) are published; every record is still a candidate that no specialist has reviewed. The reader is a Next.js app in `app/` (static export by default; `HUDA_ASK=1` builds a server with an "ask" assistant backed by PostgreSQL 18 with pgvector). Judges can type their own model key in the UI. Setup: `cd app && pnpm install && cp .env.example .env.local && pnpm dev` (the `cp` is optional for the static reader: everything that was run ran without `.env.local`). Tests: `pnpm sync-content && pnpm typecheck && pnpm test` in `app/` (the sync must come first: `app/src/content/` is generated and git-ignored, so on a fresh clone the other two fail without it), and `python3 -B -m unittest test_export_content` from inside `tools/`. The install, the tests, the static build and `pnpm dev` (in a separate copy, on another port) were run on 5 October 2026 from a copy without `.cache/` (node 22.22.2) and passed, except `python3 -B tools/export_content.py 93 107 108 112 --check-only`, which needs `.cache/records`. Book texts and the retrieval index live in the git-ignored `.cache/`, so a fresh clone cannot build new surahs. Deployment (`render.yaml`) is written but untested. Sources, tools and licenses: `docs/07-competition/sources-tools-licenses.md`. No `LICENSE` file yet; the owner has not chosen one.

</div>
