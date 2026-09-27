# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 9 | quran | ربنا ويبعث فيهم | ربنا وابعث فيهم | 1 | البقرة 2:129 |
| 9 | quran | كما رسلنا فيكم رسولا منكم يتلع عليكم | كما أرسلنا فيكم رسولا منكم يتلو عليكم | 1 | البقرة 2:151 |
| 9 | quran | ويعلمكم كتابه الحكمة | ويعلمكم الكتاب والحكمة | 1 | البقرة 2:151 |
| 9 | quran | يعلمهم ويكتاب حكمة | يعلمهم الكتاب والحكمة | 1 | البقرة 2:129؛ الآية نفسها قبلها |
| 13 | name | أبو عبد الرحمن السلم رحمه | أبو عبد الرحمن السلمي رحمه | 1 | راوي الأثر المشهور |
| 13 | hadith | كحدثنا | حدثنا | 1 | لفظ الأثر «حدثنا الذين كانوا يقرئوننا» |
| 13 | hadith | والإلم والأمل جميعا | والعلم والعمل جميعا | 1 | لفظ الأثر؛ «العلم والعمل» في السطر نفسه |
| 13 | garble | يقتذ | يقتدي | 1 | non-word |
| 15 | garble | لا نجترع | لا نجترئ | 1 | non-word; «يجترئ» في السطر نفسه |
| 15 | garble | الظوابط | الضوابط | 1 | non-word; «ضوابطه» في السطر نفسه |
| 15 | garble | وأكبر تمرة | وأكبر ثمرة | 1 | مقابل «أكبر فائدة» |
| 15 | garble | اجتماع الثنين | اجتماع اثنين | 1 | non-word |
| 15 | garble | إلقاعا | إلقاء | 1 | non-word |
| 15 | garble | إلقاع هذا | إلقاء هذا | 1 | non-word |
| 15 | garble | إلا بألم | إلا بعلم | 1 | «إلا بعلم» في السطر نفسه |
| 17 | garble | وبرك الله | وبارك الله | 1 | non-word |
| 17 | whisper-hallucination |  شكرا |  | 1 | «شكرا» الأخيرة يولّدها Whisper |

## Uncertain (left as transcribed)

- L13 `لا نحيط`: probably لا نحيد; both are real words.
- L17 `قال النهو السلام`: probably «عليه الصلاة والسلام». The hadith is paraphrased; its wording («فإذا اختلفتم فقوموا عنه») must be checked against the source.
