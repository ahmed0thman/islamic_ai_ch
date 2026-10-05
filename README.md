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

**المتطلبات:** Node 24 (الإصدار الذي يحدده `render.yaml` هو 24.16.0)، وpnpm 10.26.1 (كما في `app/package.json`)، وبايثون 3 لأدوات `tools/`، وبوستجرس 18 مع إضافة pgvector لاسترجاع «اسأل» وحده. وأول بناء أو تشغيل يحتاج اتصالًا بالشبكة ليجلب الخطوط (انظر `app/README.md`).

```bash
cd app
pnpm install
cp .env.example .env.local     # عبّئ منه ما تحتاجه فقط؛ كل القيم فارغة افتراضيًّا
pnpm dev                       # قارئ ثابت على http://localhost:3000، وقبله تُنسخ ملفات المحتوى تلقائيًّا
```

**القارئ وحده** (بلا «اسأل» وبلا قاعدة بيانات): `pnpm build` يولّد مجلد `out/` الثابت، ويُفتح بأي خادم ملفات. هذا هو الوضع الافتراضي.

**«اسأل» حيًّا:**

1. أنشئ قاعدة بوستجرس 18 فيها إضافة `vector` (ملف `app/db/rag.sql` ينشئها)، وضع رابطها في `DATABASE_URL`.
2. `pnpm rag:ingest` يملأ القاعدة بالجمل الموثقة وسجلات السور المنشورة. ويقرأ `.cache/records/<رقم>/records.v2.json` إن وُجد.
3. شغّل `HUDA_ASK=1 pnpm dev`، أو `HUDA_ASK=1 pnpm build && HUDA_ASK=1 pnpm start`. المتغير يلزم وقت البناء ووقت التشغيل معًا.
4. «نسيج لك» (تكيف النسيج مع القارئ) يعمل بـ`HUDA_WEAVE=1` بالطريقة نفسها.
5. المفتاح: إما مفتاح من متغيرات البيئة (`OPENCODE_GO_API_KEY` أو غيره)، وإما **أن يُدخل المحكّم مفتاحه هو من الواجهة** (ق-088)، فلا يحتاج مفاتيحنا. المفتاح المُدخَل يُحفظ في ذاكرة جلسة المتصفح وحدها (`sessionStorage`) ويُرسل مع كل سؤال، ولا يُخزَّن في الخادم بحسب الكود (`app/src/lib/own-key.ts`، `app/src/lib/ask/providers.ts`؛ قرأتهما ولم أجرّب).
6. السؤال بالصوت يحتاج `GROQ_API_KEY`، أو خادم ويسبر محليًّا بـ`HUDA_VOICE_STT_URL`. والميكروفون لا يعمل إلا على رابط آمن (https) أو على الجهاز نفسه.

كل المتغيرات التي يقرؤها الكود مسمّاة ومشروحة في `app/.env.example`.

**تسجيل الدخول (Clerk)** قيد الإضافة: اختياري ولا يحجب القراءة ولا «اسأل»، ويُفعَّل في بناء الخادم وحده (ق-089). متغيراته مذكورة في `app/.env.example`.

**ما لا يعمل بلا `.cache/`:** `.cache/` خارج git، وفيه نصوص الكتب (لا تُنشر، ق-131) وفهرسها (`.cache/index/sources.sqlite`) وسجلات كل سورة. فنسخة جديدة من المستودع **تقرأ السور الأربع المنشورة وتشغّل «اسأل»** (من الجمل الموثقة)، لكنها **لا تبني سورة جديدة ولا تفهرس الكتب ولا تملأ مقاطع الكتب في القاعدة** (`pnpm rag:ingest --passages` يتوقف إن غاب الفهرس). وسكربتا بناء السجلات وفحصها المشتركان في `.cache/records/108/` خارج المستودع أيضًا. (وصف مفصل: `tools/pipeline/README.md`، القسم 3.) لم أجرّب التشغيل من نسخة بلا `.cache/`، فما سبق مأخوذ من قراءة الكود: **غير متحقق بالتجربة**.

**النشر:** `render.yaml` في الجذر، وإعادة بناء القاعدة في `app/scripts/db-rebuild.md`، وإبقاء الخدمة مستيقظة في `app/scripts/keepalive.md`. **لم يُجرَّب النشر بعد.**

## إعادة الاختبار

شُغّلت هذه الأوامر على جهاز التطوير في 5 أكتوبر 2026 ونجحت (وفيه `.cache/`؛ لم تُجرَّب من نسخة بلا `.cache/`):

```bash
# التطبيق (من app/): الأنواع، والاختبارات
pnpm typecheck
pnpm test                      # 264 اختبارًا: 262 نجح، و2 تخطّاهما (لا يحتاجان قاعدة بيانات)

# بايثون (من tools/)
cd tools
python3 -B -m unittest test_export_content test_normalize_cases test_retrieve test_fetch_shamela
#   95 + 3 + 18 + 6 اختبارًا. اختبار التصدير يجب أن يُشغَّل من داخل tools/ (من الجذر يفشل الاستيراد)
cd pipeline && python3 -B -m unittest test_run_surah     # 41 اختبارًا

# فحص التصدير نفسه (من الجذر): يرفض السورة كلها عند أي فشل
python3 -B tools/export_content.py 93 107 108 112 --check-only
```

**سكربتا التقييم** موجودان في `app/package.json` ولم أشغّلهما هنا (الأول يحتاج `DATABASE_URL`، والثاني مفتاحًا أو خادمًا قائمًا):

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

**In English (short).** Huda ("guidance") is an Arabic reader that explains a Quran surah to a non-specialist at four depths. Every claim carries its source and its status; the AI weaves text from verified records and does not generate facts or rule on narrations. Four surahs (93, 107, 108, 112) are published; every record is still a candidate that no specialist has reviewed. The reader is a Next.js app in `app/` (static export by default; `HUDA_ASK=1` builds a server with an "ask" assistant backed by PostgreSQL 18 with pgvector). Judges can type their own model key in the UI. Setup: `cd app && pnpm install && cp .env.example .env.local && pnpm dev`. Tests: `pnpm typecheck && pnpm test` in `app/`, and `python3 -B -m unittest test_export_content` from inside `tools/`. Book texts and the retrieval index live in the git-ignored `.cache/`, so a fresh clone cannot build new surahs. Deployment (`render.yaml`) is written but untested. Sources, tools and licenses: `docs/07-competition/sources-tools-licenses.md`. No `LICENSE` file yet; the owner has not chosen one.

</div>
