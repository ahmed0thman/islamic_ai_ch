<div dir="rtl">

# س-09: الوصول والتباين وتنقل لوحة المفاتيح في شاشة القارئ

**سطر التشغيل:** الجلسة السحابية `session_01PfaCHytzhiCSTucsuhnFNu`، المنسّق فيبل 5.1، الوكيل `deep-analyst` (أوبس 5.5، جهد عالٍ) · بدأ: 5 أكتوبر 2026 23:07 · انتهى: 23:25 · الفرع: `cloud/accessibility` · الالتزامات: يسجّلها المنسّق في طلب الدمج.

## الجواب

**حدود الفحص (ب):** الفحص كله بقراءة الكود والأنماط وبحساب التباين. **لم أشغّل متصفحًا، ولا قارئ شاشة، ولا جهازًا،** ولم أرَ الشاشة. وما فعلته غير القراءة ثلاثة أشياء، كلها في نسخة مؤقتة خارج المستودع:
- جمّعت الأنماط بأداة التطبيق نفسها (`@tailwindcss/postcss`)، لأعرف في أي طبقة تقع كل قاعدة.
- طبّقت الرقع كلها على النسخة المؤقتة، ثم شغّلت `pnpm typecheck` فنجح، و`pnpm test` فنجح (263 نجاحًا، صفر رسوب).
- لم يُعدَّل أي ملف في `app/`. الملف الوحيد الذي أنشأته هو هذا التقرير.

**النتيجة (ب):**

| الشدة | العدد | ما هي |
|---|---|---|
| حرجة | 1 | زر «افتح المصدر» في صفيحة المصدر: نصه بلون الحبر على خلفية خضراء. التباين 1.49 في الفاتح و1.67 في الليلي، والحد 4.5 |
| متوسطة | 7 | حلقة تركيز لا تُرى على منصة الآية، وأبواب باهتة دون الحد، وأشرطة مقاطع لا تكاد تُرى، وعنصر مركّز يختفي تحت الشريط الثابت، وأزرار داخل زر في بنود التعمق، وجواب «اسأل» الأول لا يُعلَن، وآية داخل الشرح لا يعرف قارئ الشاشة أنها آية |
| منخفضة | 13 | تسع لها رقع جاهزة. وأربع بلا رقعة، لأنها تحتاج نصًّا عربيًّا جديدًا أو تجربة على جهاز |

**التباين (ب):** حسبت 84 زوجًا في كل وضع، أي 168 حسابًا. منها **15 دون الحد في الكود الذي تعرضه الشاشة: 9 في الفاتح و6 في الليلي.** وخرج من العدد حسابان:
- حد خانة «اسأل» عند التركيز في الليلي (1.96). حدّه من المستوى `AAA`، لا `AA`.
- شارة قديمة لا يصل إليها أي مسار في التطبيق (1.22).

**ما وجدته سليمًا (ب):**
- **كل ما يُضغط زر أو رابط حقيقي.** بحثت عن معالجات الضغط على غير الأزرار والروابط، فلم أجد شيئًا.
- **الصفائح والمشهد والقائمة** مبنية على نافذة `radix-ui` الحوارية. فهي تحبس التركيز، وتُغلق بمفتاح الخروج، ويعيد كودها التركيز صراحةً إلى ما فتحها.
- **ترتيب التنقل** يتبع ترتيب العناصر في الصفحة، وهو من اليمين.
- **لغة الصفحة واتجاهها** `lang="ar" dir="rtl"`.
- **كل زر أيقونة له اسم.**
- **تقليل الحركة محترم في الجملة:** قاعدة عامة في الأنماط، وكل تمرير بالكود يفحص الرغبة أولًا.
- **مساحة اللمس:** الأزرار 44px.
- **التكبير باللمس غير ممنوع.**

الأدلة في القسم التالي.

## طريقة الحساب

- **مصدر القيم (ب):** `app/src/styles/tokens.css:3-25` للفاتح و`:142-151` للليلي، لأن التطبيق يقرؤها. وقيم `design/DESIGN.md` (القسم 1.1) تطابقها.
  - أما `design/tokens.md` فقديم: لوحته رمادية (`#FAFAFA` و`#1C1C1E`) ولا يستعملها التطبيق. فلم أبنِ عليه.
  - ألوان المصادر والشارات والحالات من `content/ui.ar.json`: المفاتيح `icons` و`badges` و`states`. وتصل إلى الأنماط متغيرًا اسمه `--tone`.
- **المعادلة:** الإضاءة النسبية بمعادلة `WCAG 2`. تُحوَّل كل قناة إلى قيمة خطية: `c/12.92` إذا كانت `c ≤ 0.04045`، وإلا `((c+0.055)/1.055)^2.4`. ثم `L = 0.2126R + 0.7152G + 0.0722B`، والنسبة `(L1+0.05)/(L2+0.05)`. والحساب بأعداد عشرية بلا تقريب في الطريق.
- **خلط الألوان كما يفعل المتصفح:**
  - `color-mix(in srgb, A p%, B)` خلط خطي للقيم المشفّرة.
  - إذا كان الطرف الثاني `transparent`، فالنتيجة اللون A بشفافية p، ثم يُركَّب فوق ما تحته.
  - وكذلك `opacity`: يُركَّب العنصر كله فوق خلفيته.
- **`oklch` و`hsl`:** لا يوجد في قيم التصميم لون بصيغة `oklch` ولا `hsl`، فكلها ست عشرية. والموضع الوحيد الذي فيه `oklch` هو خلفية التمرير للزر الثانوي (`app/src/components/ui/button.tsx:19`). حوّلته في السكربت إلى `sRGB` على هذا المسار:
  - `sRGB` ← قيم خطية ← فضاء `LMS` ← `OKLab` ← `OKLCh`.
  - ثم يُخلط اللونان، وتُؤخذ زاوية اللون على القوس الأقصر.
  - ثم يُعاد اللون بالمسار نفسه معكوسًا (مصفوفات أوتوسون).
- **الحدود:**
  - 4.5 للنص العادي.
  - 3 للنص الكبير، وهو 24px فأكثر، أو 18.66px فأكثر بوزن 700.
  - 3 لما ليس نصًّا: حدود العناصر، والرموز، وحلقة التركيز، وعلامة الحالة.
  - النص العربي يبدو أصغر من اللاتيني بالمقاس نفسه. فعاملت نصوص 13 و15 و17px نصًّا عاديًّا. والاستثناء رقم الوسام: 19px عريض.
- **المقارنة بالفحص السابق (ب):** `design/DESIGN.md:96` يذكر فحصًا بالسكربت `design/bakeoff/claude/contrast.py` خرج بـ«0 أزواج راسبة من 45». أرقامي في الأزواج المشتركة تطابق أرقامه، ومنها `ink-3` على `bg` بـ4.93. وكل ما رسب عندي أزواج لم يشملها ذلك الفحص:
  - الشفافية على الأبواب.
  - حلقة التركيز على المنصة.
  - نص الرابط الموروث.
  - نص شارة النوع في الليلي، فذلك الفحص حسب الرمز وحده.
  - الأشرطة.
  - مؤشرات الحالة.
- **نص السكربت** في الملحق آخر التقرير. يُشغَّل هكذا: `python3 contrast_s09.py content/ui.ar.json > out.json`.

## جدول الملاحظات

الوسم في كل صف: الوصف (ب) لأنه نتيجة فحص، والرقعة (ج) لأنها اقتراح لم يُعتمد.

| رقم | الشدة | الموضع | ما يحدث ولمن | الرقعة |
|---|---|---|---|---|
| ح-1 | حرجة | `app/src/components/reader/source-sheet.tsx:34` و`:49`؛ `app/src/app/globals.css:14`؛ `app/src/components/ui/button.tsx:13` | زر «افتح المصدر» مكتوب `<Button variant="primary" asChild><a>`. خلفيته `bg-accent` ونصه `text-on-accent`، والقاعدتان في طبقة `utilities`. والقاعدة العامة `a { color: inherit }` خارج كل طبقة، فتغلبهما في ترتيب الطبقات. فيرث الرابط لون الحبر: **1.49 في الفاتح (أخضر داكن على أخضر داكن) و1.67 في الليلي (فاتح على أخضر فاتح).** تأكدت من موضع القاعدتين بالتجميع: `.text-on-accent` داخل `@layer utilities`، و`a { color: inherit }` خارج الطبقات. وتعليق الفريق في `app/src/styles/ask.css:27` يصف الأثر نفسه على `button`. **لمن:** كل قارئ يريد المصدر الأصلي. والزر يظهر لكل دليل له رابط: 166 من 281 في الضحى، و117 من 174 في الإخلاص، و72 من 174 في الماعون، و69 من 130 في الكوثر (عددتها في `content/export/surah-*.json`). وهو في الواجهة باب «كل دعوى بعدها علامة تفتح المصدر» | ح-1 |
| م-1 | متوسطة | `app/src/styles/reader.css:8` و`:157-158` | حلقة التركيز على أزرار أرقام الآيات في المنصة لونها `accent` على `stage-a`. **التباين 1.09 في الفاتح، فلا تُرى.** وتظهر هذه الأزرار في كل وقفة فيها أكثر من ثلاث آيات. فمستعمل لوحة المفاتيح لا يعرف أين هو. و`design/DESIGN.md:511` نصّ على هذا للشاشة العريضة، ولم يُطبَّق في الجوال | م-1 |
| م-2 | متوسطة | `app/src/styles/reader.css:192` و`:222` | عند اختيار مقطع أو آية تبهت العقد الأخرى بشفافية 0.55، وتبهت معها أبوابها، وهي أزرار ما زالت تعمل. **عنوان الباب الباهت 3.70 في الفاتح، والحد 4.5. ورقم الخرزة الباهتة 2.69 في الفاتح و3.19 في الليلي.** أما نص الآية الباهت فيبلغ حد النص الكبير (3.51). **لمن:** ضعيف البصر، ومن يقرأ في ضوء الشمس | م-2 (ج: البهتان يخف، وهذا قرار تصميم) |
| م-3 | متوسطة | `app/src/components/reader/mini-strip.tsx:22`؛ `app/src/styles/reader.css:216` | أشرطة المقاطع في الشريط المصغر أزرار تحمل `aria-pressed`، وصورتها الوحيدة خط بارتفاع 4px. لونه `accent` بنسبة 16 أو 30 أو 44% مخلوطًا بـ`surface-2`. **التباين مع خلفية الشريط 1.30 و2.26 في الفاتح، و1.59 في الليلي، والحد 3.** فلا يكاد يُرى أن هنا شيئًا يُضغط | م-3 |
| م-4 | متوسطة | `app/src/styles/reader.css:210`؛ `app/src/app/globals.css:8` | الشريط العلوي (الشريط المصغر ومقبض الدرجات) ثابت في أعلى الشاشة، والصفحة ليس فيها `scroll-padding-top`. فعند الرجوع بـ`Shift+Tab` يمرّر المتصفح العنصر المركّز إلى أعلى، فيقع تحت الشريط ويختفي. وهذا يخالف المعيار 2.4.11 في `WCAG 2.2` من المستوى `AA`. والاستنتاج من قراءة الكود، ويحتاج تجربة | م-4 |
| م-5 | متوسطة | `app/src/components/reader/details-item.tsx:13` | عنوان بند التعمق وعنوان «أسئلة أعمق» داخل `<summary>`، وفيه علامات المصدر وروابط المصطلحات. فهذه أزرار داخل زر. قارئ الشاشة يضم أسماءها إلى اسم العنوان، فيصير طويلًا: العنوان ثم «من أين جاءت هذه المعلومة؟ —…». وفي `VoiceOver` على `iOS` قد لا يصل إلى الأزرار الداخلية أصلًا. **العدد:** 15 بندًا في الضحى، و6 في الكوثر، و9 في الماعون، و7 في الإخلاص | م-5 (ج: قرار تصميم) |
| م-6 | متوسطة | `app/src/components/reader/ask-sheet.tsx:278` | منطقة الإعلان `aria-live` تُنشأ مع السؤال الأول نفسه، وقارئ الشاشة لا يعلن عادةً ما يُنشأ مع منطقته. فلا يُعلَن «نبحث…» ولا الجواب الأول. وبعد ذلك يقرأ كل جواب كاملًا، ومعه أسماء كل علاماته. **لمن:** الكفيف يسأل ولا يعرف أن الجواب وصل | م-6 |
| م-7 | متوسطة | `app/src/components/reader/inline-ayah.tsx:10-12` | الآية داخل فقرة الشرح لا يعرف قارئ الشاشة أنها آية. تُقرأ متصلة بكلام الشرح، ثم «١١٢:٥». والتفريق بين نص القرآن وكلام الشرح من صلب المشروع (ق-038). أما المنصة (`ayah-stage.tsx:17`) والآيات المتصلة (`ayah-flow.tsx:8`) فلهما اسم منطقة هو «الآيات»، وكل آية في الخيط يسبقها زر برقمها. فالثغرة في الآية داخل الفقرة وحدها | م-7 |
| خ-1 | منخفضة | `app/src/styles/reader.css:9` | في الليلي، نص شارة النوع «قول صحابي أو تابعي» (13px) في صفيحة المصدر **4.42**، والحد 4.5. والفحص السابق حسب الرمز وحده (4.39 بحد 3)، ولم يحسب النص | خ-1 |
| خ-2 | منخفضة | `ayah-node.tsx:15`؛ `ayah-stage.tsx:22`؛ `ayah-reference.tsx:8`؛ `mini-strip.tsx:23` (كلها في `app/src/components/reader/`) | زر الآية الواحدة اسمه «الآيات ٥» بالجمع، والوسام اسمه «المدى: الآيات ٥». وزر مرجع الآية يُقرأ «الآيات ٥» وعلى الشاشة «١١٢:٥». فمن يتحكم بصوته وينطق ما يراه لا يصيب الزر | خ-2 |
| خ-3 | منخفضة | `app/src/components/reader/surah-header.tsx:26`؛ `app/src/components/menu/mushaf-tab.tsx:40` | خاصية `aria-label` موضوعة على `span` عادي، وقواعد `ARIA` تمنع تسمية هذا العنصر. فأكثر قارئات الشاشة تتجاهلها، فيُقرأ «١١» وحده بلا «الآيات» | خ-3 |
| خ-4 | منخفضة | `app/src/styles/menu.css:56` و`:58` | في صف السورة الحالية في القائمة يبقى رقم السورة وعدد آياتها بلون `ink-3` على `accent-soft`: **4.42 في الفاتح و4.16 في الليلي** | خ-4 |
| خ-5 | منخفضة | `app/src/styles/menu.css:45` | زر التجميع المضغوط (الأجزاء، الأحزاب، الأرباع) لا يتميز إلا بخلفية `surface` على `surface-2` (**1.09**)، وظل خفيف، ولون النص. فلا يبلغ مؤشر الحالة 3. وقارئ الشاشة يعرف الحالة من `aria-pressed` | خ-5 |
| خ-6 | منخفضة | `app/src/styles/reader.css:203`؛ `app/src/components/reader/stop-door.tsx:25` | نقطة «قُرئت» على الباب لونها `accent` بنسبة 50%: **2.67 في الفاتح.** ولا تصل إلى قارئ الشاشة، لأنها ليست في اسم الباب | خ-6 (وإعلانها لقارئ الشاشة يحتاج نصًّا جديدًا، انظر أدناه) |
| خ-7 | منخفضة | `app/src/styles/ask.css:81-84` و`:103-106` | خانة «اسأل» تلغي حلقة التركيز، وتكتفي بتغيير لون الحد (1px) وهالة خفيفة. الفرق بين الحد قبل التركيز وبعده **1.96 في الليلي**. ليس رسوبًا في المستوى `AA`، لكنه أضعف علامة تركيز في الشاشة، وبحث القائمة يستعمل حلقة كاملة (`menu.css:30`) | خ-7 |
| خ-8 | منخفضة | `app/src/styles/ask.css:193` و`:224`؛ `app/src/components/reader/voice-button.tsx:129-140` | **مع طلب تقليل الحركة:** تتوقف الحركات، لكن الكرة وهالتها ما زالتا تكبران وتصغران مع مستوى الصوت في كل إطار، والانتقال المُلغى جعل التغير قفزًا. **وبلا طلب تقليل الحركة:** الكرة الكبيرة في «اسأل» الفارغة تدور بلا نهاية (`ask.css:226,245,259`)، ولا وسيلة لإيقافها، وهذا يخالف المعيار 2.2.2 | خ-8 للأولى. والثانية (ج): ألا تتحرك الكرة الساكنة إلا وهي تسمع أو تفكر، وهذا قرار تصميم |
| خ-9 | منخفضة | `app/src/app/globals.css:8` | القاعدة `html { font-size: 16px }` تثبّت المقاس، فمن كبّر خط المتصفح من إعداداته لا يتغير عنده شيء. أما التكبير العادي فيعمل | خ-9 |
| خ-10 | منخفضة | `app/src/components/reader/reader.tsx:200-206` | لا رابط للتخطي إلى الشرح. فمستعمل لوحة المفاتيح يمر قبل الخيط على: القائمة، والمفتاح، ووحدة القراءة، والبطل، والشريط المصغر (11 خرزة في الضحى مع أشرطتها)، والمقبض، وزر العرض | بلا رقعة: تحتاج نصًّا جديدًا (ج) |
| خ-11 | منخفضة | `app/src/components/reader/stop-scene.tsx:54` | نقاط التقدم في المشهد مخفية عن قارئ الشاشة (`aria-hidden`)، فلا يعرف الكفيف أنه في الوقفة الثالثة من سبع | بلا رقعة: تحتاج نصًّا جديدًا (ج) |
| خ-12 | منخفضة | `app/src/styles/reader.css:288` | عنوان باب التعمق مقصوص بعد ثلاثة أسطر. وفي تكبير 200% يُقص أكثر. والعنوان كاملًا في اسم الزر وفي المشهد | بلا رقعة: يحتاج نظرة على جهاز |
| خ-13 | منخفضة (بلا أثر الآن) | `app/src/app/globals.css:79` | الشارة القديمة «لا يثبت» أبيض على `ink`، وتباينها **1.22 في الليلي.** لا يستعملها إلا `app/src/components/marks.tsx`، ولا يصل إليه أي مسار، ومثله `legend.tsx` و`source-panel.tsx` و`reader.tsx` و`surah-map.tsx` و`stop-scene.tsx` و`glance-card.tsx` و`ask-box.tsx` في `app/src/components/`. فما قيل عن `surah-map.tsx`، وقد سمّته المهمة، لا يمس الشاشة الحالية | بلا رقعة: التنظيف مع حذف الملفات القديمة، وهو بإذن صاحب الفكرة (`DESIGN.md:441`) |

### نصوص عربية جديدة تحتاجها ملاحظات بلا رقعة (ج، لا تُكتب في الواجهة قبل إقرارها)

- خ-10، رابط التخطي: «انتقل إلى الشرح». يكون أول عنصر في الصفحة، ولا يظهر إلا عند التركيز، ويقود إلى `article.reading-body`.
- خ-11، موضع الوقفة لقارئ الشاشة: «الوقفة `{n}` من `{total}`». يوضع نصًّا مخفيًّا بصريًّا بجوار النقاط.
- خ-6، حالة الباب المقروء: «قرأتها». تضاف إلى اسم الباب في `stop-door.tsx:25`.

## الرقع

**التحقق (ب):**
- كل رقعة تطبق وحدها على الفرع كما هو. فحصت ذلك بـ`git apply --check`.
- وتطبق الرقع كلها معًا بالترتيب.
- وبعد تطبيقها كلها على نسخة مؤقتة نجح `pnpm typecheck` و`pnpm test`، وجُمّعت الأنماط بلا خطأ.
- **تنبيه:** `globals.css` و`menu.css` و`reader.css` معدّلة على الجهاز ولم تُدفع (`docs/08-open/cloud-tasks.md`، المهمة س-09). فقد تزيح تعديلاتُ الجهاز سياق الرقع، وتحتاج حينها مطابقة يدوية.
- **النصوص:** لا تضيف أي رقعة نصًّا عربيًّا جديدًا. ما تعرضه نصوص موجودة في `content/ui.ar.json`: `ui.reader.unit_ayah` («الآية»)، و`ui.icons.ayah.label` («آية»)، و`ui.reader.ayahs_title`، و`ui.ask.loading`، و`ui.ask.answer_title`، والعبارات الثابتة.

### رقعة ح-1

لون نص الزر الأساسي يُكتب خارج الطبقات، فيصح «افتح المصدر» وكل زر أساسي يأتي بعده. بعد الرقعة: 9.33 في الفاتح و7.78 في الليلي.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -95,6 +95,8 @@
 .huda-button { border-radius: var(--radius-s); }
 .huda-button[data-variant="pill"], .huda-button[data-variant="quiet"], .huda-button[data-variant="primary"], .huda-button[data-variant="round"] { border-radius: var(--radius-pill); }
 .huda-button[data-variant="round"] { inline-size: var(--control-height); block-size: var(--control-height); padding: 0; }
+/* The global `a, button { color: inherit }` is unlayered and outranks the variant's text-on-accent utility (s-09). */
+.huda-button[data-variant="primary"] { color: var(--on-accent); }
 .source-marker { display: inline-flex; align-items: center; flex-wrap: wrap; gap: .25rem; vertical-align: baseline; margin-inline: .25rem; min-inline-size: 1.5rem; min-block-size: 1.5rem; max-inline-size: 100%; padding: 0; border: 0; background: transparent; font: inherit; line-height: 1.5; white-space: normal; }
 .source-marker .source-chip { transition: transform var(--dur-fast) var(--ease); }
 .source-marker:hover .source-chip { transform: translateY(-2px); }
```

### رقعة م-1

حلقة ذهبية على المنصة، كما في `DESIGN.md:511`. بعد الرقعة: 6.32 في الفاتح و6.76 في الليلي.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -156,6 +156,8 @@
 .stage-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-sm); margin-block-start: .75rem; }
 .stage-chips .huda-button { background: transparent; color: var(--stage-ink); border-color: color-mix(in srgb,var(--stage-ink) 50%,transparent); }
 .stage-chips .huda-button[aria-pressed="true"] { background: var(--stage-ink); color: var(--stage-b); }
+/* The accent ring is 1.09:1 on the light stage (DESIGN.md 9.5): gold on the stage. */
+.stage-chips .huda-button:focus-visible { outline-color: var(--gold-stage); }
 .scene-heading { padding: var(--space-lg) var(--gutter) var(--space-xs); }
 .scene-kicker { color: var(--accent); font-size: var(--text-ui); font-weight: 600; margin-block-end: var(--space-sm); }
 .huda-scene-title { font-size: var(--text-title); font-weight: 700; line-height: var(--leading-title); text-wrap: balance; }
```

### رقعة م-2

تقل الشفافية. بعد الرقعة: عنوان الباب 5.01 والآية 4.70 في الفاتح، والخرزة 4.74 في الفاتح و5.32 في الليلي. (ج): البهتان يصير أخف، والقرار للتصميم.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -189,7 +189,7 @@
 .ayah-medal[aria-pressed="true"] { color: var(--on-accent); background: var(--accent); }
 .ayah-node-body { min-inline-size: 0; padding-inline-start: .875rem; }
 .thread-verse { font-family: var(--font-mushaf); font-size: var(--text-verse); line-height: var(--leading-verse); font-weight: 400; text-wrap: pretty; margin-block-end: var(--space-xs); }
-.ayah-node.is-dimmed { opacity: .55; }
+.ayah-node.is-dimmed { opacity: .65; }
 .door-wrap { position: relative; display: grid; grid-template-rows: 1fr; margin-block-start: var(--space-sm); }
 .door-wrap::before { content: ""; position: absolute; inset-inline-start: -2.625rem; inset-block-start: 1.875rem; inline-size: 2.625rem; block-size: 2px; background: var(--accent); opacity: .55; }
 .door-wrap::after { content: ""; position: absolute; inset-inline-start: -2.875rem; inset-block-start: 1.625rem; inline-size: .625rem; block-size: .625rem; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--bg); }
@@ -219,7 +219,7 @@
 .mini-bead-control { grid-row: 2; min-block-size: var(--control-height); padding: 0; border: 0; background: transparent; color: var(--ink-2); }
 .mini-bead { display: grid; place-items: center; min-block-size: 2rem; border: 1px solid var(--border-ui); border-radius: var(--radius-s); background: var(--surface); font-family: var(--font-quote); font-size: var(--text-ui); font-weight: 700; line-height: 1.5; font-variant-numeric: tabular-nums; }
 .mini-bead-control[aria-current="true"] .mini-bead { background: var(--gold); color: var(--on-gold); border-color: var(--gold); }
-.mini-bead-control.is-dimmed { opacity: .55; }
+.mini-bead-control.is-dimmed { opacity: .8; }
 .mini-pins { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: var(--space-xs); min-block-size: .875rem; }
 .mini-pins span { inline-size: .375rem; block-size: .375rem; border-radius: 50%; background: var(--accent); animation: sheet-fade-in var(--dur-state) var(--ease); }
 .depth-dial { position: relative; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 0; margin-block-start: .5rem; padding: .25rem; border: 1px solid var(--border-ui); border-radius: var(--radius); background: var(--surface-2); isolation: isolate; }
```

### رقعة م-3

حد بلون `border-ui` حول الشريط، وتبقى درجات الخضرة كما هي. بعد الرقعة: الحد 3.05 أو أكثر في الوضعين.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -213,7 +213,7 @@
 .mini-grid { display: grid; gap: 0 .25rem; }
 .mini-group { display: contents; }
 .mini-rail { grid-row: 1; display: grid; align-items: center; min-block-size: 1.5rem; padding: 0; border: 0; background: transparent; }
-.mini-rail span { block-size: .25rem; border-radius: var(--radius-pill); }
+.mini-rail span { block-size: .25rem; border-radius: var(--radius-pill); box-shadow: 0 0 0 1px var(--border-ui); }
 .mini-rail[aria-pressed="true"] span { background: var(--accent) !important; }
 .mini-rail.is-plain { min-block-size: .5rem; }
 .mini-bead-control { grid-row: 2; min-block-size: var(--control-height); padding: 0; border: 0; background: transparent; color: var(--ink-2); }
```

### رقعة م-4

مسافة تمرير علوية بقدر الشريط الثابت. قيمة `10rem` مأخوذة من `scroll-margin-block-start` للعقدة (`reader.css:185`)، وتحتاج قياسًا على الجهاز.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -236,6 +236,8 @@
 .ayah-node { isolation: isolate; }
 @media (prefers-reduced-transparency: reduce) { .console { background: var(--bg); backdrop-filter: none; } }
 .huda-reader { margin-inline: calc(-1 * var(--gutter)); }
+/* The sticky console must not cover what Shift+Tab focuses; 10rem is the ayah node's own scroll margin. */
+html:has(.huda-reader .console) { scroll-padding-block-start: 10rem; }
 .huda-reader .reading-body { padding-block: 0 var(--space-xl); }
 .surah-header { text-align: start; }
 .reader-appbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); min-block-size: 3.75rem; padding: var(--space-md) var(--gutter) 0; }
```

### رقعة م-5

(ج، قرار تصميم) يصير العنوان نصًّا مجردًا داخل `<summary>`، وتنتقل علاماته إلى أول جسم البند. ومصطلح العنوان يبقى كلمة عادية، ويُفتح من «مصطلحات الدرجة». وبديل لا يغيّر الشكل: يُترك كما هو ويُجرَّب في `VoiceOver`.

```diff
--- a/app/src/components/reader/details-item.tsx
+++ b/app/src/components/reader/details-item.tsx
@@ -1,7 +1,7 @@
 "use client";
 
 import { PlusSignIcon, MinusSignIcon } from "@hugeicons/core-free-icons";
-import type { Block } from "@/lib/types";
+import type { Block, TitleSegment } from "@/lib/types";
 import { Icon } from "@/components/ui/icon";
 import type { ReadingProps } from "./reading-context";
 import { ClaimText } from "./claim-text";
@@ -9,8 +9,12 @@
 
 export type DetailsItemProps = ReadingProps & { block: Extract<Block, { type: "details" }>; defaultOpen?: boolean; /** Shown with the title on the closed row, e.g. the depth a deeper question comes from. */ meta?: React.ReactNode; children?: React.ReactNode };
 export function DetailsItem({ block, defaultOpen = false, meta, children, ...reading }: DetailsItemProps) {
+  // A <summary> is itself the control: buttons inside it (markers, terms) are nested controls that screen readers flatten or skip.
+  // The title stays plain text there; its markers open the body. (s-09, a design choice for the owner.)
+  const title = block.title.map((segment) => segment.t === "mark" ? "" : segment.v).join("");
+  const marks = block.title.filter((segment): segment is Extract<TitleSegment, { t: "mark" }> => segment.t === "mark");
   return <details className="details-item" open={defaultOpen || undefined}>
-    <summary>{meta ? <span className="details-summary-text"><ClaimText block={{ type: "paragraph", role: "claim", segments: block.title }} mode="flow" inline {...reading} />{meta}</span> : <ClaimText block={{ type: "paragraph", role: "claim", segments: block.title }} mode="flow" inline {...reading} />}<span className="details-indicator"><span className="detail-plus"><Icon icon={PlusSignIcon} /></span><span className="detail-minus"><Icon icon={MinusSignIcon} /></span></span></summary>
-    <div className="details-item-body">{block.blocks.map((inner, index) => <ParagraphView key={index} block={inner} mode="flow" {...reading} />)}{children}</div>
+    <summary>{meta ? <span className="details-summary-text"><span>{title}</span>{meta}</span> : <span>{title}</span>}<span className="details-indicator"><span className="detail-plus"><Icon icon={PlusSignIcon} /></span><span className="detail-minus"><Icon icon={MinusSignIcon} /></span></span></summary>
+    <div className="details-item-body">{marks.length ? <ClaimText block={{ type: "paragraph", role: "claim", segments: marks }} mode="flow" {...reading} /> : null}{block.blocks.map((inner, index) => <ParagraphView key={index} block={inner} mode="flow" {...reading} />)}{children}</div>
   </details>;
 }
```

### رقعة م-6

سطر حالة دائم ومخفي بصريًّا يعلن البحث ثم الجواب. ولا تبقى القائمة نفسها منطقة إعلان.

```diff
--- a/app/src/components/reader/ask-sheet.tsx
+++ b/app/src/components/reader/ask-sheet.tsx
@@ -217,15 +217,22 @@
       </div>)}</>;
   }
 
+  const fixedText = (status: AskResponse["status"]) => status === "unavailable" ? ui.ask.unavailable
+    : status === "fatwa" ? ui.phrases.fatwa
+    : status === "out_of_scope" ? ui.phrases.out_of_scope
+    : status === "not_arabic" ? ui.phrases.arabic_only
+    : ui.phrases.insufficient_sources;
+  // One status line that is always in the page, so the first answer is announced too; the thread itself is not live (it would read every answer in full).
+  const lastTurn = ask.turns.at(-1);
+  const announced = !lastTurn ? "" : lastTurn.loading ? ui.ask.loading
+    : lastTurn.result?.status === "answer" ? ui.ask.answer_title
+    : lastTurn.result ? fixedText(lastTurn.result.status) : "";
+
   function renderResult(turn: AskTurn) {
     const result = turn.result!;
     const composed = composedView(result);
     const drawing = drawingFor(reading, result.atoms, result.extra);
-    const fixed = result.status === "unavailable" ? ui.ask.unavailable
-      : result.status === "fatwa" ? ui.phrases.fatwa
-      : result.status === "out_of_scope" ? ui.phrases.out_of_scope
-      : result.status === "not_arabic" ? ui.phrases.arabic_only
-      : ui.phrases.insufficient_sources;
+    const fixed = fixedText(result.status);
 
     return <>
       {result.status === "answer" ? (
@@ -250,6 +257,7 @@
     <button type="button" className={keyStyles.open} aria-haspopup="dialog" aria-expanded={keyOpen} onClick={() => setKeyOpen(true)}>{ui.judge_key.open}</button>
   </>} ui={ui} onClose={onClose}>
     <div className="ask-sheet">
+      <p className="sr-only" role="status" aria-live="polite">{announced}</p>
       <div className="ask-body" ref={bodyRef}>
         {ownProvider ? <p className={keyStyles.using} role="status">{ui.judge_key.using.replace("{provider}", ui.judge_key.providers[ownProvider])}</p>
           : ask.turns.some((turn) => turn.result?.status === "unavailable") ? <p className={keyStyles.using}>{ui.judge_key.intro}</p> : null}
@@ -275,7 +283,7 @@
              </div>}
           </div>
         ) : (
-          <div aria-live="polite">
+          <div>
             <ol className="ask-thread">
               {ask.turns.map(turn => (
                  <li className="ask-turn" key={turn.id}>
```

### رقعة م-7

كلمة «آية:» مخفية بصريًّا قبل الآية داخل الفقرة. وتُستثنى من العبارة التي تعرضها صفيحة المصدر (`sheet-provider.tsx:21`) حتى لا تظهر فيها.

```diff
--- a/app/src/components/reader/inline-ayah.tsx
+++ b/app/src/components/reader/inline-ayah.tsx
@@ -8,7 +8,7 @@
 export function InlineAyah({ ayah, ui, marker, reference }: InlineAyahProps) {
   const [start, end] = splitLastWord(ayahWords(ayah.text));
   return <span className="huda-inline-ayah" data-ayah-key={ayah.key} style={{ "--tone": ui.icons.ayah.color } as CSSProperties}>
-    {start}<span className="claim-ending">{end}{marker}</span>
+    <span className="sr-only">{ui.icons.ayah.label}: </span>{start}<span className="claim-ending">{end}{marker}</span>
     <span className="inline-ayah-reference"><SourceGlyph kind="ayah" size={16} />{reference ?? <bdi dir="ltr">{ayah.key.split(":").map((number) => numeral(Number(number))).join(":")}</bdi>}</span>
   </span>;
 }
--- a/app/src/components/reader/sheet-provider.tsx
+++ b/app/src/components/reader/sheet-provider.tsx
@@ -18,7 +18,7 @@
   const run = opener instanceof HTMLElement ? opener.closest<HTMLElement>("[data-run]") : null;
   if (!run) return undefined;
   const copy = run.cloneNode(true) as HTMLElement;
-  copy.querySelectorAll(".source-marker, .inline-ayah-reference").forEach((node) => node.remove());
+  copy.querySelectorAll(".source-marker, .inline-ayah-reference, .sr-only").forEach((node) => node.remove());
   return copy.textContent?.replace(/\s+/g, " ").trim() || undefined;
 }
 export function SheetProvider({ ui, children }: { ui: Ui; children: ReactNode }) {
```

### رقعة خ-1

في الليلي وحده يُخلط لون النوع بنسبة 45% بدل 55%. بعد الرقعة: أدنى قيمة 5.49 لكل الألوان التسعة وحالتيها. (ج): تُحدَّث قاعدة الألوان في `DESIGN.md:94`.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -7,6 +7,8 @@
 .huda-button:active { transform: scale(.96); }
 .huda-button:focus-visible, .huda-badge:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
 .source-tone { background: color-mix(in srgb, var(--tone) 22%, transparent); color: color-mix(in srgb, var(--tone) 55%, var(--ink)); }
+/* Dark: at 55% the athar label is 4.42:1 on its chip; 45% lifts the lowest tone to 5.49:1 (s-09). */
+@media (prefers-color-scheme: dark) { .source-tone { color: color-mix(in srgb, var(--tone) 45%, var(--ink)); } }
 .source-badge[data-state] { background: transparent; border: 1.5px dashed var(--tone) !important; }
 .source-chip { --s: 1.625rem; display: inline-grid; place-items: center; box-sizing: border-box; inline-size: var(--s); min-inline-size: var(--s); block-size: var(--s); padding: 0; border-radius: calc(var(--s) * .3); line-height: 1; }
 .source-chip svg { inline-size: calc(var(--s) * .62); block-size: calc(var(--s) * .62); }
```

### رقعة خ-2

المفرد «الآية» من `ui.reader.unit_ayah`، والاسم الظاهر جزء من الاسم المقروء.

```diff
--- a/app/src/components/reader/ayah-node.tsx
+++ b/app/src/components/reader/ayah-node.tsx
@@ -12,7 +12,7 @@
 export type AyahNodeProps = { station: MapStation; scope: Scope; dimmed: boolean; ui: Ui; onScope: () => void; onOpen: (stop: SceneUnit) => void; visited: ReadonlySet<number>; children?: ReactNode };
 export function AyahNode({ station, scope, dimmed, ui, onScope, onOpen, visited, children }: AyahNodeProps) {
   return <section className={`ayah-node${dimmed ? " is-dimmed" : ""}`} data-station-key={station.ayah.key}>
-    <button type="button" className="ayah-medal" aria-haspopup="dialog" aria-label={`${ui.reader.range}: ${ui.reader.ayahs_title} ${numeral(station.ayah.no)}`} aria-pressed={scope.kind === "ayah" && scope.key === station.ayah.key} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onScope(); }}>{numeral(station.ayah.no)}</button>
+    <button type="button" className="ayah-medal" aria-haspopup="dialog" aria-label={`${ui.reader.range}: ${ui.reader.unit_ayah} ${numeral(station.ayah.no)}`} aria-pressed={scope.kind === "ayah" && scope.key === station.ayah.key} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onScope(); }}>{numeral(station.ayah.no)}</button>
     <div className="ayah-node-body"><p className="thread-verse" data-ayah-key={station.ayah.key}>{ayahWords(station.ayah.text)}</p><div className="station-doors">{children ?? <StationDoors stops={station.stops} visited={visited} ui={ui} onOpen={onOpen} />}</div></div>
   </section>;
 }
--- a/app/src/components/reader/ayah-reference.tsx
+++ b/app/src/components/reader/ayah-reference.tsx
@@ -5,11 +5,11 @@
 
 export type AyahReferenceProps = { ayah: Ayah; ui: Ui };
 export function AyahReference({ ayah, ui }: AyahReferenceProps) {
-  return <button type="button" className="ayah-reference-button" aria-label={`${ui.reader.ayahs_title} ${numeral(ayah.no)}`} onClick={(event) => {
+  return <button type="button" className="ayah-reference-button" onClick={(event) => {
     const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-ayah-key]"));
     const target = candidates.find((element) => element.dataset.ayahKey === ayah.key && element.closest(".ayah-stage") && element.getClientRects().length)
       ?? event.currentTarget.closest<HTMLElement>("[data-ayah-key]");
     target?.setAttribute("data-relation-highlight", "true");
     window.setTimeout(() => target?.removeAttribute("data-relation-highlight"), 200);
-  }}><bdi dir="ltr">{ayah.key.split(":").map((number) => numeral(Number(number))).join(":")}</bdi></button>;
+  }}><span className="sr-only">{ui.reader.unit_ayah} </span><bdi dir="ltr">{ayah.key.split(":").map((number) => numeral(Number(number))).join(":")}</bdi></button>;
 }
--- a/app/src/components/reader/ayah-stage.tsx
+++ b/app/src/components/reader/ayah-stage.tsx
@@ -19,6 +19,6 @@
       const [start, end] = splitLastWord(ayahWords(ayah.text));
       return <p className="stage-verse" data-ayah-key={ayah.key} key={ayah.key}>{start}<span className="claim-ending">{end}{"\u00a0"}<span className="ayah-gem">{numeral(ayah.no)}</span></span></p>;
     })}
-    {ayahs.length > 3 ? <div className="stage-chips">{ayahs.map((ayah) => <Button key={ayah.key} variant="round" size="icon" aria-pressed={current.key === ayah.key} aria-label={`${ui.reader.ayahs_title} ${numeral(ayah.no)}`} onClick={() => onSelect?.(ayah.key)}>{numeral(ayah.no)}</Button>)}</div> : null}
+    {ayahs.length > 3 ? <div className="stage-chips">{ayahs.map((ayah) => <Button key={ayah.key} variant="round" size="icon" aria-pressed={current.key === ayah.key} aria-label={`${ui.reader.unit_ayah} ${numeral(ayah.no)}`} onClick={() => onSelect?.(ayah.key)}>{numeral(ayah.no)}</Button>)}</div> : null}
   </section>;
 }
--- a/app/src/components/reader/mini-strip.tsx
+++ b/app/src/components/reader/mini-strip.tsx
@@ -5,8 +5,8 @@
 import { scopeContains } from "@/lib/scope";
 import { numeral } from "@/lib/numerals";
 
-export type MiniStripProps = { groups: MapGroup[]; depthPins: Record<string, number>; itemPins?: Record<string, number>; current: string | null; scope: Scope; onJump: (key: string) => void; onScope: (scope: Scope) => void; ariaLabel: string };
-export function MiniStrip({ groups, depthPins, itemPins = {}, current, scope, onJump, onScope, ariaLabel }: MiniStripProps) {
+export type MiniStripProps = { groups: MapGroup[]; depthPins: Record<string, number>; itemPins?: Record<string, number>; current: string | null; scope: Scope; onJump: (key: string) => void; onScope: (scope: Scope) => void; ariaLabel: string; /** One ayah, for the bead names (ui.reader.unit_ayah). */ unitLabel?: string };
+export function MiniStrip({ groups, depthPins, itemPins = {}, current, scope, onJump, onScope, ariaLabel, unitLabel = ariaLabel }: MiniStripProps) {
   const total = groups.reduce((sum, group) => sum + group.stations.length, 0);
   const compact = isLongSurah(total);
   const tracks = groups.flatMap((group, index) => [...(index ? ["var(--space-xs)"] : []), ...group.stations.map(() => "minmax(0,1fr)")]);
@@ -20,7 +20,7 @@
       group.stations.forEach((station, stationIndex) => { if (station.ayah.key === current) currentColumn = start + stationIndex; });
       return <div className="mini-group" key={group.passage?.id ?? "surah"}>
         {group.passage ? <button type="button" className="mini-rail" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-label={group.passage.title} aria-pressed={scope.kind === "passage" && scope.id === group.passage.id} onClick={() => onScope({ kind: "passage", id: group.passage!.id })}><span style={{ background: `color-mix(in srgb,var(--accent) ${16 + Math.min(index, 2) * 14}%,var(--surface-2))` }} /></button> : <span className="mini-rail is-plain" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-hidden="true" />}
-        {compact ? null : group.stations.map((station, stationIndex) => <button key={station.ayah.key} type="button" className={`mini-bead-control${scopeContains(station.ayah.key, scope, passages) ? "" : " is-dimmed"}${scope.kind === "ayah" && scope.key === station.ayah.key ? " is-selected" : ""}`} style={{ gridColumn: start + stationIndex }} aria-label={`${ariaLabel} ${numeral(station.ayah.no)}`} aria-current={current === station.ayah.key ? "true" : undefined} onClick={() => onJump(station.ayah.key)}>
+        {compact ? null : group.stations.map((station, stationIndex) => <button key={station.ayah.key} type="button" className={`mini-bead-control${scopeContains(station.ayah.key, scope, passages) ? "" : " is-dimmed"}${scope.kind === "ayah" && scope.key === station.ayah.key ? " is-selected" : ""}`} style={{ gridColumn: start + stationIndex }} aria-label={`${unitLabel} ${numeral(station.ayah.no)}`} aria-current={current === station.ayah.key ? "true" : undefined} onClick={() => onJump(station.ayah.key)}>
           <span className="mini-bead">{numeral(station.ayah.no)}</span><span className="mini-pins" aria-hidden="true">{Array.from({ length: depthPins[station.ayah.key] ?? 0 }, (_, pin) => <span key={`stop-${pin}`} />)}{Array.from({ length: itemPins[station.ayah.key] ?? 0 }, (_, pin) => <span className="is-depth-pin" key={`item-${pin}`} />)}</span>
         </button>)}
       </div>;
--- a/app/src/components/reader/reader.tsx
+++ b/app/src/components/reader/reader.tsx
@@ -200,7 +200,7 @@
     <SurahHeader surah={surah} surahs={surahs} scope={scope} ui={ui} onOpenUnit={() => openUnit(surah, scope, chooseScope)} onMap={mapped && (view === "text" || stop || closing) ? (stop || closing ? backToMap : () => chooseView("map")) : undefined} />
     {showMap && hero ? <div className="hero-area"><HeroQuestion stop={hero} ui={ui} animate={settled} onOpen={openStop} /></div> : null}
     <div className="console">
-      {depth !== 3 || mapped ? <MiniStrip groups={map.groups} depthPins={Object.fromEntries(map.groups.flatMap((group) => group.stations.map((station) => [station.ayah.key, station.stops.length])))} itemPins={items.pins.reduce<Record<string, number>>((counts, pin) => ({ ...counts, [pin.stationKey]: (counts[pin.stationKey] ?? 0) + 1 }), {})} current={currentAyah} scope={scope} onJump={jump} onScope={chooseScope} ariaLabel={ui.reader.ayahs_title} /> : null}
+      {depth !== 3 || mapped ? <MiniStrip groups={map.groups} depthPins={Object.fromEntries(map.groups.flatMap((group) => group.stations.map((station) => [station.ayah.key, station.stops.length])))} itemPins={items.pins.reduce<Record<string, number>>((counts, pin) => ({ ...counts, [pin.stationKey]: (counts[pin.stationKey] ?? 0) + 1 }), {})} current={currentAyah} scope={scope} onJump={jump} onScope={chooseScope} ariaLabel={ui.reader.ayahs_title} unitLabel={ui.reader.unit_ayah} /> : null}
       <DepthDial depth={depth} levels={ui.levels} label={ui.reader.choose_depth} onChange={(next) => { setDepth(next); setStopNumber(null); setClosingOpen(false); remember(next); updateUrl(next, null, view === "text" || !(maps[next].stops.length || itemModels[next].units.length), true); }} />
     </div>
     {mapped ? <ViewToggle view={view} ui={ui} onChange={chooseView} /> : null}
```

### رقعة خ-3

نص مخفي بصريًّا بدل `aria-label` على `span`.

```diff
--- a/app/src/components/menu/mushaf-tab.tsx
+++ b/app/src/components/menu/mushaf-tab.tsx
@@ -37,7 +37,7 @@
   const body = <>
     <span className="menu-surah-no">{numeral(no)}</span>
     <span className="menu-surah-name">{surah.name}</span>
-    <span className="menu-surah-count" aria-label={`${ui.reader.ayahs_title}: ${numeral(surah.ayahs)}`}>{numeral(surah.ayahs)}</span>
+    <span className="menu-surah-count"><span className="sr-only">{ui.reader.ayahs_title}: </span>{numeral(surah.ayahs)}</span>
   </>;
   if (!open) return <li><div className="menu-surah" data-closed="">{body}<span className="menu-soon">{ui.menu.soon}</span></div></li>;
   return <li><a className="menu-surah" href={`/s/${no}/`} aria-current={no === current ? "page" : undefined}
--- a/app/src/components/reader/surah-header.tsx
+++ b/app/src/components/reader/surah-header.tsx
@@ -23,6 +23,6 @@
   }
   return <header className="surah-header">
     <div className="reader-appbar"><div className="reader-brand"><AppMenu ui={ui} current={surah.surah.no} ayahCount={surah.surah.ayah_count} />{onMap ? <Button variant="quiet" size="icon" aria-label={ui.reader.map_view} onClick={onMap}><Icon icon={ArrowRight01Icon} /></Button> : null}<span>{ui.app_name}</span></div><LegendTrigger ui={ui} /></div>
-    <div className="surah-cover"><h1>{surah.surah.name}</h1><div className="cover-meta"><span className="cover-count" aria-label={`${ui.reader.ayahs_title}: ${numeral(surah.surah.ayah_count)}`}><b>{numeral(surah.surah.ayah_count)}</b><span aria-hidden="true"><SourceGlyph kind="ayah" size={20} /></span></span><p>{ui.tagline}</p></div><Button variant="pill" className="reading-unit-button" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpenUnit(); }}><Icon icon={Bookmark01Icon} /><span>{unit}</span></Button></div>
+    <div className="surah-cover"><h1>{surah.surah.name}</h1><div className="cover-meta"><span className="cover-count"><span className="sr-only">{ui.reader.ayahs_title}: </span><b>{numeral(surah.surah.ayah_count)}</b><span aria-hidden="true"><SourceGlyph kind="ayah" size={20} /></span></span><p>{ui.tagline}</p></div><Button variant="pill" className="reading-unit-button" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpenUnit(); }}><Icon icon={Bookmark01Icon} /><span>{unit}</span></Button></div>
   </header>;
 }
```

### رقعة خ-4

تُكتب الأرقام بلون `ink-2` في الصف الحالي. بعد الرقعة: 6.40 في الفاتح و6.01 في الليلي.

```diff
--- a/app/src/styles/menu.css
+++ b/app/src/styles/menu.css
@@ -56,6 +56,7 @@
 a.menu-surah[aria-current="page"] { background: var(--accent-soft); color: var(--accent); }
 a.menu-surah svg { color: var(--accent); }
 .menu-surah-no, .menu-surah-count { font-size: var(--text-label); line-height: var(--leading-ui); color: var(--ink-3); font-variant-numeric: tabular-nums; }
+a.menu-surah[aria-current="page"] :is(.menu-surah-no, .menu-surah-count) { color: var(--ink-2); }
 .menu-surah-name { font-family: var(--font-quran); font-size: var(--text-quote); line-height: 1.9; }
 .menu-surah[data-closed] { grid-template-columns: 2rem minmax(0, 1fr) auto auto; }
 .menu-surah[data-closed] .menu-surah-name { color: var(--ink-3); }
```

### رقعة خ-5

حد بلون `accent` للزر المضغوط. بعد الرقعة: 9.26 في الفاتح و7.72 في الليلي.

```diff
--- a/app/src/styles/menu.css
+++ b/app/src/styles/menu.css
@@ -42,7 +42,7 @@
 .menu-status { margin-block-start: var(--space-lg); font-size: var(--text-ui); color: var(--ink-2); }
 .menu-levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-block-start: var(--space-md); padding: var(--space-xs); border: 1px solid var(--border-ui); border-radius: var(--radius); background: var(--surface-2); }
 .menu-level { min-block-size: var(--control-height); border: 0; border-radius: var(--radius-s); background: none; color: var(--ink-2); font-size: var(--text-ui); line-height: var(--leading-ui); font-weight: 600; transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
-.menu-level[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
+.menu-level[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow), inset 0 0 0 1px var(--accent); }
 .menu-group { margin-block-start: var(--space-md); }
 .menu-group-title { position: sticky; inset-block-start: 0; display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-sm); padding-block: var(--space-sm); background: var(--surface); border-block-end: 1px solid var(--line); font-size: var(--text-ui); line-height: var(--leading-ui); font-weight: 700; color: var(--accent); }
 .menu-group-title small { font-size: var(--text-label); font-weight: 400; color: var(--ink-3); }
```

### رقعة خ-6

نقطة «قُرئت» بشفافية 0.7. بعد الرقعة: 4.40 في الفاتح و4.73 في الليلي.

```diff
--- a/app/src/styles/reader.css
+++ b/app/src/styles/reader.css
@@ -200,7 +200,7 @@
 .stop-door-title { font-size: var(--text-door); line-height: var(--leading-door); font-weight: 600; text-wrap: balance; }
 .stop-door-icons { display: flex; gap: .25rem; flex-wrap: wrap; grid-column: 1; }
 .stop-door-chevron { grid-column: 2; grid-row: 1 / span 2; color: var(--ink-3); }
-.stop-door[data-seen]::after { content: ""; position: absolute; inset-block-start: var(--space-sm); inset-inline-end: var(--space-sm); inline-size: .5rem; block-size: .5rem; border-radius: 50%; background: var(--accent); opacity: .5; }
+.stop-door[data-seen]::after { content: ""; position: absolute; inset-block-start: var(--space-sm); inset-inline-end: var(--space-sm); inline-size: .5rem; block-size: .5rem; border-radius: 50%; background: var(--accent); opacity: .7; }
 .thread-ayah-range > summary { min-block-size: var(--control-height); padding: var(--space-sm); font-size: var(--text-ui); color: var(--ink-2); cursor: pointer; }
 @supports (animation-timeline: view()) {
   .ayah-node::after { animation: thread-draw var(--dur-door) var(--ease) both; animation-timeline: view(); animation-range: entry 10% cover 55%; }
```

### رقعة خ-7

حلقة كاملة حول خانة «اسأل»، كما في بحث القائمة.

```diff
--- a/app/src/styles/ask.css
+++ b/app/src/styles/ask.css
@@ -81,6 +81,8 @@
 .ask-composer:focus-within {
   border-color: var(--accent);
   box-shadow: 0 0 0 3px var(--accent-soft);
+  outline: 3px solid var(--accent);
+  outline-offset: 2px;
 }
 .ask-input {
   grid-column: 1;
```

### رقعة خ-8

تثبت الكرة وهالتها تحت طلب تقليل الحركة. ويبقى عنوان «نسمعك» والعدّاد يدلان على السماع.

```diff
--- a/app/src/styles/ask.css
+++ b/app/src/styles/ask.css
@@ -355,6 +355,14 @@
     animation: none !important;
     transition: none !important;
   }
+  /* the voice level still rescaled the ball and its glow every frame: hold them still; the clock and the listening title say it listens */
+  .ask-orb::before,
+  .ask-orb-sphere {
+    transform: none;
+  }
+  .ask-orb::before {
+    opacity: 0.6;
+  }
 }
 
 /* Views in the body */
```

### رقعة خ-9

المقاس الأساسي 100%، فيبقى 16px لمن لم يغيّر إعدادات المتصفح.

```diff
--- a/app/src/app/globals.css
+++ b/app/src/app/globals.css
@@ -5,7 +5,7 @@
 @import "../styles/menu.css";
 
 * { box-sizing: border-box; }
-html { font-size: 16px; background: var(--paper); scroll-padding-bottom: calc(var(--legend-occupied-height, var(--legend-height)) + var(--space-xl)); }
+html { font-size: 100%; background: var(--paper); scroll-padding-bottom: calc(var(--legend-occupied-height, var(--legend-height)) + var(--space-xl)); }
 body { margin: 0; color: var(--text); background: var(--paper); font-family: var(--font-body), sans-serif; font-size: var(--size-body); line-height: var(--leading-body); }
 button, input { font: inherit; }
 button, a, label { -webkit-tap-highlight-color: transparent; }
```

## جدول التباين

كل الأزواج بالحساب (ب). «نعم» تعني أن الزوج يبلغ الحد، و«لا» أنه دونه. والقيم قبل الرقع. والمواضع في `app/src/` ما لم يُذكر غير ذلك. والرموز: `ink` الحبر، و`ink-2` و`ink-3` درجتاه الأخف، و`surface` و`surface-2` السطوح، و`bg` الأرضية، و`accent` الأخضر، و`stage` منصة الآية.

| # | المجموعة | الزوج | الحد | فاتح | ليلي | الموضع |
|---|---|---|---|---|---|---|
| 1 | النص | `ink` على `bg` | 4.5 | 13.68 نعم | 14.80 نعم | `tokens.css:6` |
| 2 | النص | `ink-2` على `bg` | 4.5 | 7.13 نعم | 8.12 نعم | `tokens.css:7` |
| 3 | النص الخافت | `ink-3` على `bg` | 4.5 | 4.93 نعم | 5.63 نعم | `tokens.css:8` |
| 4 | النص | `ink` على `surface` | 4.5 | 15.08 نعم | 13.81 نعم | `tokens.css:6` |
| 5 | النص | `ink-2` على `surface` | 4.5 | 7.86 نعم | 7.58 نعم | `tokens.css:7` |
| 6 | النص الخافت | `ink-3` على `surface` | 4.5 | 5.43 نعم | 5.25 نعم | `tokens.css:8` |
| 7 | النص | `ink` على `surface-2` | 4.5 | 13.81 نعم | 12.88 نعم | `tokens.css:6` |
| 8 | النص | `ink-2` على `surface-2` | 4.5 | 7.20 نعم | 7.07 نعم | `tokens.css:7` |
| 9 | النص الخافت | `ink-3` على `surface-2` | 4.5 | 4.97 نعم | 4.90 نعم | `tokens.css:8` |
| 10 | النص الخافت | `ink-3` على `accent-soft` فوق `surface` (رقم السورة الحالية وعدد آياتها في القائمة) | 4.5 | **4.42 لا** | **4.16 لا** | `menu.css:56,58` |
| 11 | النص الخافت | `ink-3` مرجع الآية داخل كتلة الآية (`tone` `ayah 11%` مع `surface`) | 4.5 | 4.71 نعم | 4.75 نعم | `reader.css:109,113` |
| 12 | النص الخافت | `placeholder` `ink-3` في خانة «اسأل» (`bg`) | 4.5 | 4.93 نعم | 5.63 نعم | `ask.css:108-110` |
| 13 | النص الخافت | `placeholder` `ink-3` في بحث القائمة (`surface-2`) | 4.5 | 4.97 نعم | 4.90 نعم | `menu.css:33` |
| 14 | الإبراز | `accent` على `bg` (مصطلح، عنوان المقطع، زر العرض) | 4.5 | 9.17 نعم | 8.87 نعم | `reader.css:102,183,267` |
| 15 | الإبراز | `accent` على `surface` (تبويب القائمة، عنوان المجموعة) | 4.5 | 10.11 نعم | 8.27 نعم | `menu.css:22,47` |
| 16 | الإبراز | `accent` على `accent-soft` فوق `surface` (السورة الحالية في القائمة) | 4.5 | 8.23 نعم | 6.56 نعم | `menu.css:56` |
| 17 | الإبراز | `accent` على باب الرف (`accent 10%` مع `surface`) | 4.5 | 8.53 نعم | 6.85 نعم | `reader.css:292` |
| 18 | الإبراز | `on-accent` على `accent` (بطاقة التالي، زر الإرسال، الوسام المضغوط) | 4.5 | 9.33 نعم | 7.78 نعم | `reader.css:165,189; ask.css:130` |
| 19 | الإبراز | `gold-strong` على `surface` (رقم الوسام 19px عريض = كبير) | 3 | 5.92 نعم | 9.18 نعم | `reader.css:188` |
| 20 | الإبراز | `gold-strong` على `surface` (شارة «تصحيح فهم شائع» 13px) | 4.5 | 5.92 نعم | 9.18 نعم | `reader.css:361` |
| 21 | الإبراز | `gold-strong` على `bg` (اسم السورة في الخلاصة 17px) | 4.5 | 5.37 نعم | 9.84 نعم | `reader.css:331` |
| 22 | الإبراز | `gold-strong` رقم الآية في الآيات المتصلة (15px) على كتلة الآية | 4.5 | 5.14 نعم | 8.31 نعم | `reader.css:110,112` |
| 23 | الإبراز | `on-gold` على `gold` (الخرزة الحالية 15px) | 4.5 | 4.66 نعم | 8.01 نعم | `reader.css:221` |
| 24 | المنصة | `stage-ink` على `stage-a` (الآية، سؤال البطل) | 4.5 | 9.94 نعم | 10.62 نعم | `reader.css:152,255` |
| 25 | المنصة | `gold-stage` رقم الآية على `stage-a` (15px) | 4.5 | 6.32 نعم | 6.76 نعم | `reader.css:155` |
| 26 | المنصة | `stage-ink` على `stage-b` (الآية، سؤال البطل) | 4.5 | 13.57 نعم | 13.57 نعم | `reader.css:152,255` |
| 27 | المنصة | `gold-stage` رقم الآية على `stage-b` (15px) | 4.5 | 8.64 نعم | 8.64 نعم | `reader.css:155` |
| 28 | المنصة | `stage-b` على `stage-ink` (رقم الآية المضغوط) | 4.5 | 13.57 نعم | 13.57 نعم | `reader.css:158` |
| 29 | علامة المصدر | رمز `ayah` على رقعته فوق `surface` | 3 | 6.17 نعم | 5.36 نعم | `reader.css:9; source-chip.tsx:17` |
| 30 | علامة المصدر | رمز `ayah` على رقعته فوق `bg` | 3 | 5.66 نعم | 5.77 نعم | `reader.css:9; source-chip.tsx:17` |
| 31 | علامة المصدر | شارة نوع `ayah` (نص 13px) فوق `surface` | 4.5 | 6.17 نعم | 5.36 نعم | `reader.css:21; source-chip.tsx:23` |
| 32 | علامة المصدر | رمز `hadith` على رقعته فوق `surface` | 3 | 6.50 نعم | 5.12 نعم | `reader.css:9; source-chip.tsx:17` |
| 33 | علامة المصدر | رمز `hadith` على رقعته فوق `bg` | 3 | 5.96 نعم | 5.50 نعم | `reader.css:9; source-chip.tsx:17` |
| 34 | علامة المصدر | شارة نوع `hadith` (نص 13px) فوق `surface` | 4.5 | 6.50 نعم | 5.12 نعم | `reader.css:21; source-chip.tsx:23` |
| 35 | علامة المصدر | رمز `athar` على رقعته فوق `surface` | 3 | 8.13 نعم | 4.42 نعم | `reader.css:9; source-chip.tsx:17` |
| 36 | علامة المصدر | رمز `athar` على رقعته فوق `bg` | 3 | 7.44 نعم | 4.70 نعم | `reader.css:9; source-chip.tsx:17` |
| 37 | علامة المصدر | شارة نوع `athar` (نص 13px) فوق `surface` | 4.5 | 8.13 نعم | **4.42 لا** | `reader.css:21; source-chip.tsx:23` |
| 38 | علامة المصدر | رمز `scholar` على رقعته فوق `surface` | 3 | 6.33 نعم | 5.37 نعم | `reader.css:9; source-chip.tsx:17` |
| 39 | علامة المصدر | رمز `scholar` على رقعته فوق `bg` | 3 | 5.82 نعم | 5.78 نعم | `reader.css:9; source-chip.tsx:17` |
| 40 | علامة المصدر | شارة نوع `scholar` (نص 13px) فوق `surface` | 4.5 | 6.33 نعم | 5.37 نعم | `reader.css:21; source-chip.tsx:23` |
| 41 | علامة المصدر | رمز `link` على رقعته فوق `surface` | 3 | 5.71 نعم | 5.63 نعم | `reader.css:9; source-chip.tsx:17` |
| 42 | علامة المصدر | رمز `link` على رقعته فوق `bg` | 3 | 5.26 نعم | 6.06 نعم | `reader.css:9; source-chip.tsx:17` |
| 43 | علامة المصدر | شارة نوع `link` (نص 13px) فوق `surface` | 4.5 | 5.71 نعم | 5.63 نعم | `reader.css:21; source-chip.tsx:23` |
| 44 | علامة المصدر | رمز `hidaya` على رقعته فوق `surface` | 3 | 7.27 نعم | 4.64 نعم | `reader.css:9; source-chip.tsx:17` |
| 45 | علامة المصدر | رمز `hidaya` على رقعته فوق `bg` | 3 | 6.66 نعم | 4.93 نعم | `reader.css:9; source-chip.tsx:17` |
| 46 | علامة المصدر | شارة نوع `hidaya` (نص 13px) فوق `surface` | 4.5 | 7.27 نعم | 4.64 نعم | `reader.css:21; source-chip.tsx:23` |
| 47 | شارات الثبوت | نص شارة `thabit` (13px) فوق `bg` | 4.5 | 5.29 نعم | 6.08 نعم | `reader.css:9,24; badge.tsx:11` |
| 48 | شارات الثبوت | نص شارة `thabit` (13px) فوق `surface` | 4.5 | 5.76 نعم | 5.64 نعم | `reader.css:9,24; badge.tsx:11` |
| 49 | شارات الثبوت | نص شارة `la_yathbut` (13px) فوق `bg` | 4.5 | 6.16 نعم | 5.44 نعم | `reader.css:9,24; badge.tsx:11` |
| 50 | شارات الثبوت | نص شارة `la_yathbut` (13px) فوق `surface` | 4.5 | 6.71 نعم | 5.09 نعم | `reader.css:9,24; badge.tsx:11` |
| 51 | شارات الثبوت | نص شارة `khilaf_mutabar` (13px) فوق `bg` | 4.5 | 5.32 نعم | 5.82 نعم | `reader.css:9,24; badge.tsx:11` |
| 52 | شارات الثبوت | نص شارة `khilaf_mutabar` (13px) فوق `surface` | 4.5 | 5.80 نعم | 5.41 نعم | `reader.css:9,24; badge.tsx:11` |
| 53 | شارات الحالة | نص شارة `report_unjudged` (خلفية شفافة) على `bg` | 4.5 | 6.12 نعم | 8.39 نعم | `reader.css:10` |
| 54 | شارات الحالة | إطار شارة `report_unjudged` المتقطع على `bg` | 3 | 3.14 نعم | 4.98 نعم | `reader.css:10` |
| 55 | شارات الحالة | نص شارة `report_unjudged` (خلفية شفافة) على `surface` | 4.5 | 6.75 نعم | 7.83 نعم | `reader.css:10` |
| 56 | شارات الحالة | إطار شارة `report_unjudged` المتقطع على `surface` | 3 | 3.46 نعم | 4.64 نعم | `reader.css:10` |
| 57 | شارات الحالة | نص شارة `source_direct` (خلفية شفافة) على `bg` | 4.5 | 7.64 نعم | 7.17 نعم | `reader.css:10` |
| 58 | شارات الحالة | إطار شارة `source_direct` المتقطع على `bg` | 3 | 4.61 نعم | 3.39 نعم | `reader.css:10` |
| 59 | شارات الحالة | نص شارة `source_direct` (خلفية شفافة) على `surface` | 4.5 | 8.42 نعم | 6.69 نعم | `reader.css:10` |
| 60 | شارات الحالة | إطار شارة `source_direct` المتقطع على `surface` | 3 | 5.08 نعم | 3.16 نعم | `reader.css:10` |
| 61 | علامة المصدر | رمز المصدر على بطاقة البطل (`stage-ink` على `stage-ink 14%` فوق `stage-a`) | 3 | 6.80 نعم | 7.21 نعم | `reader.css:264` |
| 62 | حدود العناصر | `border-ui` على `bg` | 3 | 3.05 نعم | 4.52 نعم | `tokens.css:11` |
| 63 | حدود العناصر | `border-ui` على `surface` | 3 | 3.13 نعم | 4.42 نعم | `tokens.css:11` |
| 64 | حدود العناصر | `border-ui` على `surface-2` | 3 | 3.06 نعم | 4.29 نعم | `tokens.css:11` |
| 65 | حدود العناصر | شريط المقطع في الشريط المصغر (`accent 16%` مع `surface-2`) على `console` | 3 | **1.30 لا** | **1.59 لا** | `mini-strip.tsx:22` |
| 66 | حدود العناصر | شريط المقطع الثالث (`accent 44%` مع `surface-2`) على `console` | 3 | **2.26 لا** | 3.01 نعم | `mini-strip.tsx:22` |
| 67 | حدود العناصر | خط الدرجة المختارة `gold` على `surface` | 3 | 3.67 نعم | 7.49 نعم | `reader.css:230` |
| 68 | حدود العناصر | زر التجميع المضغوط: `surface` على `surface-2` (الفرق الوحيد غير لون النص) | 3 | **1.09 لا** | **1.07 لا** | `menu.css:45` |
| 69 | حدود العناصر | نقطة الوقفة المقروءة `accent 50%` على `surface` | 3 | **2.67 لا** | 3.07 نعم | `reader.css:203` |
| 70 | حلقة التركيز | `accent` على `bg` | 3 | 9.17 نعم | 8.87 نعم | `globals.css:16; reader.css:8` |
| 71 | حلقة التركيز | `accent` على `surface` | 3 | 10.11 نعم | 8.27 نعم | `globals.css:16` |
| 72 | حلقة التركيز | `accent` على `stage-a` (أزرار أرقام الآيات في المنصة) | 3 | **1.09 لا** | 6.09 نعم | `reader.css:8,157` |
| 73 | حلقة التركيز | `gold-stage` على `stage-a` (البديل المقترح، `DESIGN.md`:511) | 3 | 6.32 نعم | 6.76 نعم | `DESIGN.md:511` |
| 74 | حلقة التركيز | حد خانة «اسأل» عند التركيز: `accent` مقابل `border-ui` قبله | 3 | 3.00 نعم | **1.96 لا** | `ask.css:81-84` |
| 75 | الباهت | نص الآية في عقدة خارج النطاق (`ink` بشفافية .55 على `bg`، 28px كبير) | 3 | 3.51 نعم | 5.21 نعم | `reader.css:192` |
| 76 | الباهت | عنوان باب داخل عقدة باهتة (`ink` على `surface`، المجموعة .55 فوق `bg`، 17px) | 4.5 | **3.70 لا** | 5.03 نعم | `reader.css:192,197,200` |
| 77 | الباهت | رقم خرزة باهتة (`ink-2` على `surface`، .55 فوق `console`) | 4.5 | **2.69 لا** | **3.19 لا** | `reader.css:222` |
| 78 | الباهت | سورة «قريبًا»: الاسم `ink-3` على `surface` | 4.5 | 5.43 نعم | 5.25 نعم | `menu.css:61` |
| 79 | الباهت | سورة «قريبًا»: كلمة «قريبًا» `ink-3` على `surface` | 4.5 | 5.43 نعم | 5.25 نعم | `menu.css:62` |
| 80 | الباهت | آية في سورة بلا شرح: `ink-2` على `surface` | 4.5 | 7.86 نعم | 7.58 نعم | `menu.css:71` |
| 81 | الباهت | نص خانة «اسأل» أثناء التسجيل (`ink` بشفافية .7 على `bg`) | 4.5 | 5.48 نعم | 7.71 نعم | `ask.css:111-113` |
| 82 | خلل الطبقات | نص «افتح المصدر»: `ink` الموروث على `accent` | 4.5 | **1.49 لا** | **1.67 لا** | `source-sheet.tsx:34,49; globals.css:14; button.tsx:13` |
| 83 | خلل الطبقات | كود ميت: شارة «لا يثبت» القديمة `white` على `ink` | 4.5 | 15.88 نعم | **1.22 لا** | `globals.css:79` |
| 84 | تحويل `oklch` | `ink` على تمرير الزر الثانوي `color-mix`(`in` `oklch`, `surface-2`, `ink 5%`) | 4.5 | 12.43 نعم | 11.57 نعم | `button.tsx:19; misconception-frame.tsx:19` |

**الخلاصة:** 15 زوجًا دون الحد في الكود الحي: 9 في الفاتح (الصفوف 10، 65، 66، 68، 69، 72، 76، 77، 82)، و6 في الليلي (الصفوف 10، 37، 65، 68، 77، 82). وصفّان خارج العد: الصف 74 في الليلي (حدّه من المستوى `AAA`)، والصف 83 (كود لا يصل إليه مسار).

## ما يحتاج تجربة على جهاز، وما بقي بلا حسم

1. **كيف ينطق قارئ الشاشة النص فعلًا.** لم أسمع شيئًا، وأربعة أشياء تحتاج سماعًا:
   - نص المصحف بعلامات الرسم العثماني (`uthmanic_hafs_v20.ttf`، والنص يمر بـ`ayahWords`).
   - رمز «ﷺ» في أسماء المصادر.
   - الأرقام الهندية في «١١٢:٥».
   - اسم علامة المصدر، ومثاله المحسوب من الضحى: «من أين جاءت هذه المعلومة؟ — قول النبي ﷺ، قول عالم — عدد المصادر: ٢» (`source-marker.tsx:16`).

   وتُجرَّب على `VoiceOver` (`iOS` و`macOS`)، و`TalkBack`، و`NVDA` بصوت عربي. **(ب): غير متحقق.**
2. **أين يرجع التركيز بعد التنقل بين الوقفات.** عند إغلاق المشهد يعيد `scene-shell.tsx:27` التركيز إلى ما فتح المشهد أول مرة. وفي الوقت نفسه يركّز `surah-thread.tsx:28-32` على باب الوقفة الحالية. وأيهما يقع أخيرًا يتوقف على توقيت `radix-ui` عند إزالة النافذة، فلا يُحسم إلا في متصفح. **(ب): بلا حسم.**
3. **تكبير 200%، وعرض 320px بلا تمرير أفقي.** أرقام الخرز في أعمدة ضيقة (`mini-strip.tsx:12` و`reader.css:220`)، وعنوان باب التعمق المقصوص (خ-12)، وشريط التطبيق العلوي. قراءة الكود لا تكشف القص، وفيه `overflow-x: clip` على الشريط المصغر. **(ب): يحتاج نظرة.**
4. **قيمة `10rem` في رقعة م-4** تقدير. ارتفاع الشريط الثابت يتغير بين السورة الطويلة والقصيرة، ومع التفاف أسماء الدرجات. **(ب).**
5. **رقعة م-5 تغيّر شكل البند.** فلا تُطبَّق قبل تجربة `VoiceOver` على `iOS`، أو قبل قول صاحب الفكرة. **(ج).**
6. **الحدود مكتوبة للحرف اللاتيني.** النص العربي بـ13px يبلغ الحد بالحساب: 4.93 لـ`ink-3` على الأرضية. لكن الحساب لا يقيس وضوح الحرف العربي الصغير، والحكم فيه بالعين. **(ب).**
7. **مسافات النص** (المعيار 1.4.12): زيادة المسافة بين الحروف تكسر اتصال الحروف العربية، فلا يُفحص هذا المعيار بالطريقة اللاتينية. **(ب): لم يُفحص.**

## أقوى اعتراض على النتيجة

**الاعتراض:** الملاحظة الحرجة مبنية على استنتاج من ترتيب الطبقات، لا على شاشة رأيتها. ثم إن الأنماط الثلاثة معدّلة على الجهاز ولم تُدفع، فربما أصلح الجهاز هذا كله وأنا لا أراه. وأرقام الأسطر قد تكون قديمة.

**ما يبقى منه:**
- الشطر الأول يضعف أمام دليلين:
  - **التجميع:** `.text-on-accent` داخل `@layer utilities`، و`a { color: inherit }` خارج الطبقات. وقاعدة الطبقات في المتصفح أن الإعلان الذي خارج الطبقات يغلب ما داخلها، أيًّا كانت الخصوصية.
  - **تعليق الفريق:** في `app/src/styles/ask.css:27` يصف الفريق الأثر نفسه على الأزرار، وأصلحه هناك وحده.
  - وفتح صفيحة مصدر واحدة في المتصفح يحسم الأمر في ثوانٍ.
- **أما الشطر الثاني فيبقى قائمًا:** كل ما في هذا التقرير عن `globals.css` و`menu.css` و`reader.css` يصف ما في الفرع، لا ما على الجهاز. فلتُطابَق الرقع يدويًّا عند التطبيق.
- **واعتراض أصغر:** قد يُقال إن العقد الباهتة «غير فعالة»، فتُستثنى من حد التباين. وهذا لا يصح على الأبواب، لأنها أزرار تعمل وهي باهتة.

## مقترحات للسجل والفهرس

كلها (ج). ولا قرار فيها يُنسب إلى صاحب الفكرة.

- **سطر للفهرس** (`docs/README.md`، تحت «`08-open`: المفتوح»): «[`cloud-reports/s-09-accessibility.md`](08-open/cloud-reports/s-09-accessibility.md): تقرير الوصول والتباين ولوحة المفاتيح في شاشة القارئ، مع رقع مقترحة (س-09).»
- **فكرة لـ`docs/ideas.md`:** تطبيق ح-1 قبل التسليم. هي سطر نمط واحد، وتمس كل صفيحة مصدر فيها رابط.
- **فكرة لـ`docs/ideas.md`:** قرارات تصميم تنتظر صاحب الفكرة:
  - درجة البهتان عند اختيار نطاق (م-2).
  - عنوان بند التعمق بلا علامات داخله (م-5).
  - إيقاف دوران الكرة الساكنة في «اسأل» (خ-8).
- **فكرة لـ`docs/ideas.md`:** النصوص الثلاثة المقترحة أعلاه: «انتقل إلى الشرح»، و«الوقفة `{n}` من `{total}`»، و«قرأتها».
- **تنبيه على وثيقتين** (لا تعديل فيه من هنا):
  - `design/DESIGN.md:96` يقول «0 أزواج راسبة». وهذا صحيح للأزواج الخمسة والأربعين التي فحصها، لا للشاشة الحالية.
  - و`design/tokens.md` لوحة قديمة لا يقرؤها التطبيق. يحسن أن يُكتب في أوله أن `app/src/styles/tokens.css` حلّ محله.
- **لا قرار جديد للسجل.**

## ملحق: سكربت الحساب

حُفظ نصه هنا لأن المجلد المؤقت قد يُحذف بين الجلسات. يُشغَّل من جذر المستودع بعد حفظه في ملف: `python3 contrast_s09.py content/ui.ar.json > out.json`.

```python
#!/usr/bin/env python3
"""S-09 contrast audit: WCAG 2.x relative luminance and contrast ratio for every text/background
and control/background pair found in app/src/styles (tokens.css, reader.css, menu.css, ask.css, globals.css)
and components. Light and dark. No rounding of intermediate channels (floats), unlike the bakeoff script.

Colour model, as browsers do it:
- color-mix(in srgb, A p%, B) = per-channel linear interpolation of the gamma-encoded sRGB values.
- color-mix(in srgb, A p%, transparent) = A at alpha p (premultiplied interpolation), then composited
  over its backdrop: A*p + backdrop*(1-p) (compositing is in gamma-encoded sRGB).
- opacity: o on an element = every pixel of the element composited at alpha o over the backdrop.
- oklch: color-mix(in oklch, ...) converted sRGB -> linear -> LMS -> OKLab -> OKLCh, mixed (hue on the
  shorter arc), and back (Bjorn Ottosson's matrices). Used only for one hover background.
"""
import math, json, sys

def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) / 255 for i in (0, 2, 4))
def mix(a, b, pa):  # pa = share of a, srgb interpolation
    return tuple(a[i] * pa + b[i] * (1 - pa) for i in range(3))
over = lambda fg, alpha, bg: mix(fg, bg, alpha)
def lin(v): return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def unlin(v): return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
def lum(c):
    r, g, b = map(lin, c); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def ratio(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)
def to_oklch(c):
    r, g, b = map(lin, c)
    l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
    m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
    s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b
    l, m, s = (x ** (1/3) for x in (l, m, s))
    L = 0.2104542553*l + 0.7936177850*m - 0.0040720468*s
    A = 1.9779984951*l - 2.4285922050*m + 0.4505937099*s
    B = 0.0259040371*l + 0.7827717662*m - 0.8086757660*s
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360
def from_oklch(L, C, H):
    A, B = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774*A + 0.2158037573*B) ** 3
    m = (L - 0.1055613458*A - 0.0638541728*B) ** 3
    s = (L - 0.0894841775*A - 1.2914855480*B) ** 3
    r = 4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    b = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    return tuple(min(1, max(0, unlin(v))) for v in (r, g, b))
def mix_oklch(a, b, pa):
    (L1, C1, H1), (L2, C2, H2) = to_oklch(a), to_oklch(b)
    d = ((H2 - H1 + 180) % 360) - 180
    return from_oklch(L1*pa + L2*(1-pa), C1*pa + C2*(1-pa), (H1 + d*(1-pa)) % 360)

# app/src/styles/tokens.css:3-25 (light) and 142-151 (dark)
P = {
 'light': dict(bg='#f1eee4', surface='#fbf9f3', surface2='#f3efe3', ink='#1c2420', ink2='#46514a', ink3='#5e6962',
               accent='#14472f', on_accent='#f4f0e2', gold='#9f7d27', gold_strong='#7a5c12', on_gold='#1c1608',
               gold_stage='#d9bc77', stage_a='#14402f', stage_b='#0b271c', stage_ink='#f2eddd', stage_mute='#a9c4b0',
               line_rgb='#1c2420', line_a=.13, line_strong_a=.26, border_ui_a=.5),
 'dark':  dict(bg='#14161a', surface='#1a1d22', surface2='#1f232a', ink='#ece8de', ink2='#a9aeb6', ink3='#8a9098',
               accent='#7fc49c', on_accent='#0b271c', gold='#c9a95c', gold_strong='#d9bc77', on_gold='#1a1608',
               gold_stage='#d9bc77', stage_a='#133b2b', stage_b='#0b271c', stage_ink='#f2eddd', stage_mute='#a9c4b0',
               line_rgb='#ece8de', line_a=.14, line_strong_a=.30, border_ui_a=.5),
}
ui = json.load(open(sys.argv[1]))
ICONS = {k: v['color'] for k, v in ui['icons'].items()}
BADGES = {k: v['color'] for k, v in ui['badges'].items()}
STATES = {k: v['color'] for k, v in ui['states'].items()}

T, LG, NT = 4.5, 3.0, 3.0   # normal text, large text, non-text (controls, glyphs, focus, state)
def rows_for(mode):
    p = {k: (hx(v) if isinstance(v, str) else v) for k, v in P[mode].items()}
    bg, sf, s2, ink, ink2, ink3 = p['bg'], p['surface'], p['surface2'], p['ink'], p['ink2'], p['ink3']
    acc, on_acc = p['accent'], p['on_accent']
    border_ui = lambda b: over(p['line_rgb'], p['border_ui_a'], b)
    acc_soft = lambda b: over(acc, .12, b)
    console = over(bg, .82, bg)  # .console = bg 82% over the page (bg) behind it
    R = []
    add = lambda grp, label, fg, b, need, where: R.append((grp, label, fg, b, need, where))
    # 1. Body and secondary text
    for nm, b in (('bg', bg), ('surface', sf), ('surface-2', s2)):
        add('النص', f'ink على {nm}', ink, b, T, 'tokens.css:6')
        add('النص', f'ink-2 على {nm}', ink2, b, T, 'tokens.css:7')
        add('النص الخافت', f'ink-3 على {nm}', ink3, b, T, 'tokens.css:8')
    add('النص الخافت', 'ink-3 على accent-soft فوق surface (رقم السورة الحالية وعدد آياتها في القائمة)', ink3, acc_soft(sf), T, 'menu.css:56,58')
    add('النص الخافت', 'ink-3 مرجع الآية داخل كتلة الآية (tone ayah 11% مع surface)', ink3, mix(hx(ICONS['ayah']), sf, .11), T, 'reader.css:109,113')
    add('النص الخافت', 'placeholder ink-3 في خانة «اسأل» (bg)', ink3, bg, T, 'ask.css:108-110')
    add('النص الخافت', 'placeholder ink-3 في بحث القائمة (surface-2)', ink3, s2, T, 'menu.css:33')
    # 2. Accent and gold text
    add('الإبراز', 'accent على bg (مصطلح، عنوان المقطع، زر العرض)', acc, bg, T, 'reader.css:102,183,267')
    add('الإبراز', 'accent على surface (تبويب القائمة، عنوان المجموعة)', acc, sf, T, 'menu.css:22,47')
    add('الإبراز', 'accent على accent-soft فوق surface (السورة الحالية في القائمة)', acc, acc_soft(sf), T, 'menu.css:56')
    add('الإبراز', 'accent على باب الرف (accent 10% مع surface)', acc, mix(acc, sf, .10), T, 'reader.css:292')
    add('الإبراز', 'on-accent على accent (بطاقة التالي، زر الإرسال، الوسام المضغوط)', on_acc, acc, T, 'reader.css:165,189; ask.css:130')
    add('الإبراز', 'gold-strong على surface (رقم الوسام 19px عريض = كبير)', p['gold_strong'], sf, LG, 'reader.css:188')
    add('الإبراز', 'gold-strong على surface (شارة «تصحيح فهم شائع» 13px)', p['gold_strong'], sf, T, 'reader.css:361')
    add('الإبراز', 'gold-strong على bg (اسم السورة في الخلاصة 17px)', p['gold_strong'], bg, T, 'reader.css:331')
    add('الإبراز', 'gold-strong رقم الآية في الآيات المتصلة (15px) على كتلة الآية', p['gold_strong'], mix(hx(ICONS['ayah']), sf, .11), T, 'reader.css:110,112')
    add('الإبراز', 'on-gold على gold (الخرزة الحالية 15px)', p['on_gold'], p['gold'], T, 'reader.css:221')
    # 3. Stage (dark green in both modes)
    for nm, b in (('stage-a', p['stage_a']), ('stage-b', p['stage_b'])):
        add('المنصة', f'stage-ink على {nm} (الآية، سؤال البطل)', p['stage_ink'], b, T, 'reader.css:152,255')
        add('المنصة', f'gold-stage رقم الآية على {nm} (15px)', p['gold_stage'], b, T, 'reader.css:155')
    add('المنصة', 'stage-b على stage-ink (رقم الآية المضغوط)', p['stage_b'], p['stage_ink'], T, 'reader.css:158')
    # 4. Source marker chips (glyph only, non-text) and badges (text)
    for k, t in ICONS.items():
        tc = hx(t); fg = mix(tc, ink, .55)
        for nm, b in (('surface', sf), ('bg', bg)):
            add('علامة المصدر', f'رمز {k} على رقعته فوق {nm}', fg, over(tc, .22, b), NT, 'reader.css:9; source-chip.tsx:17')
        add('علامة المصدر', f'شارة نوع {k} (نص 13px) فوق surface', fg, over(tc, .22, sf), T, 'reader.css:21; source-chip.tsx:23')
    for k, t in BADGES.items():
        tc = hx(t); fg = mix(tc, ink, .55)
        for nm, b in (('bg', bg), ('surface', sf)):
            add('شارات الثبوت', f'نص شارة {k} (13px) فوق {nm}', fg, over(tc, .22, b), T, 'reader.css:9,24; badge.tsx:11')
    for k, t in STATES.items():
        tc = hx(t); fg = mix(tc, ink, .55)
        for nm, b in (('bg', bg), ('surface', sf)):
            add('شارات الحالة', f'نص شارة {k} (خلفية شفافة) على {nm}', fg, b, T, 'reader.css:10')
            add('شارات الحالة', f'إطار شارة {k} المتقطع على {nm}', tc, b, NT, 'reader.css:10')
    sc = hx(p['stage_ink'] if False else P[mode]['stage_ink'])
    add('علامة المصدر', 'رمز المصدر على بطاقة البطل (stage-ink على stage-ink 14% فوق stage-a)', sc, over(sc, .14, p['stage_a']), NT, 'reader.css:264')
    # 5. Controls, focus, state (non-text 3:1)
    for nm, b in (('bg', bg), ('surface', sf), ('surface-2', s2)):
        add('حدود العناصر', f'border-ui على {nm}', border_ui(b), b, NT, 'tokens.css:11')
    add('حدود العناصر', 'شريط المقطع في الشريط المصغر (accent 16% مع surface-2) على console', mix(acc, s2, .16), console, NT, 'mini-strip.tsx:22')
    add('حدود العناصر', 'شريط المقطع الثالث (accent 44% مع surface-2) على console', mix(acc, s2, .44), console, NT, 'mini-strip.tsx:22')
    add('حدود العناصر', 'خط الدرجة المختارة gold على surface', p['gold'], sf, NT, 'reader.css:230')
    add('حدود العناصر', 'زر التجميع المضغوط: surface على surface-2 (الفرق الوحيد غير لون النص)', sf, s2, NT, 'menu.css:45')
    add('حدود العناصر', 'نقطة الوقفة المقروءة accent 50% على surface', over(acc, .5, sf), sf, NT, 'reader.css:203')
    add('حلقة التركيز', 'accent على bg', acc, bg, NT, 'globals.css:16; reader.css:8')
    add('حلقة التركيز', 'accent على surface', acc, sf, NT, 'globals.css:16')
    add('حلقة التركيز', 'accent على stage-a (أزرار أرقام الآيات في المنصة)', acc, p['stage_a'], NT, 'reader.css:8,157')
    add('حلقة التركيز', 'gold-stage على stage-a (البديل المقترح، DESIGN.md:511)', p['gold_stage'], p['stage_a'], NT, 'DESIGN.md:511')
    add('حلقة التركيز', 'حد خانة «اسأل» عند التركيز: accent مقابل border-ui قبله', acc, border_ui(bg), NT, 'ask.css:81-84')
    # 6. Dimmed (opacity .55) still-active content
    add('الباهت', 'نص الآية في عقدة خارج النطاق (ink بشفافية .55 على bg، 28px كبير)', over(ink, .55, bg), bg, LG, 'reader.css:192')
    add('الباهت', 'عنوان باب داخل عقدة باهتة (ink على surface، المجموعة .55 فوق bg، 17px)', over(ink, .55, bg), over(sf, .55, bg), T, 'reader.css:192,197,200')
    add('الباهت', 'رقم خرزة باهتة (ink-2 على surface، .55 فوق console)', over(ink2, .55, console), over(sf, .55, console), T, 'reader.css:222')
    add('الباهت', 'سورة «قريبًا»: الاسم ink-3 على surface', ink3, sf, T, 'menu.css:61')
    add('الباهت', 'سورة «قريبًا»: كلمة «قريبًا» ink-3 على surface', ink3, sf, T, 'menu.css:62')
    add('الباهت', 'آية في سورة بلا شرح: ink-2 على surface', ink2, sf, T, 'menu.css:71')
    add('الباهت', 'نص خانة «اسأل» أثناء التسجيل (ink بشفافية .7 على bg)', over(ink, .7, bg), bg, T, 'ask.css:111-113')
    # 7. Defects found by reading the cascade
    add('خلل الطبقات', 'نص «افتح المصدر»: ink الموروث على accent', ink, acc, T, 'source-sheet.tsx:34,49; globals.css:14; button.tsx:13')
    add('خلل الطبقات', 'كود ميت: شارة «لا يثبت» القديمة white على ink', hx('#ffffff'), ink, T, 'globals.css:79')
    # 8. oklch hover (shadcn secondary)
    add('تحويل oklch', 'ink على تمرير الزر الثانوي color-mix(in oklch, surface-2, ink 5%)', ink, mix_oklch(s2, ink, .95), T, 'button.tsx:19; misconception-frame.tsx:19')
    return R

def main():
    out = []
    for mode in ('light', 'dark'):
        fails = 0
        for grp, label, fg, b, need, where in rows_for(mode):
            r = ratio(fg, b); ok = r >= need - 1e-9; fails += not ok
            out.append(dict(mode=mode, group=grp, label=label, ratio=round(r, 2), need=need, ok=ok, where=where))
        print(f'{mode}: {fails} failing / {len(rows_for(mode))}', file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
main()
```

</div>
