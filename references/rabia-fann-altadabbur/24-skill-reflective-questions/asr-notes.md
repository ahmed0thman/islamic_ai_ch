# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 7 | garble | فائلا | فاعلا | 1 | non-word |
| 9 | hadith | شاخ بدر | أشياخ بدر | 2 | البخاري: «يدخلني مع أشياخ بدر» |
| 9 | hadith | عند كل يهي | عند كل آية | 1 | أثر مجاهد «أوقفه عند كل آية» |
| 9 | garble | قوله تآلى | قوله تعالى | 1 | non-word |
| 9 | garble | المجلس يتأمن | المجلس يتأمل | 1 | السياق: «ماذا تستشعر» بعدها |
| 11 | quran | إن أعطيناك الكوثر | إنا أعطيناك الكوثر | 1 | الكوثر 108:1 |
| 13 | quran | إن أعطيناك الكوثر | إنا أعطيناك الكوثر | 1 | الكوثر 108:1 |
| 13 | garble | كيف نحق الصدق | كيف نحقق الصدق | 2 | «أحقق الحمد» في السطر نفسه |
| 15 | garble | الآيات الوالدة | الآيات الواردة | 1 | السياق |
| 15 | garble | ورادت | وردت | 1 | non-word |
| 17 | garble | اتتاح سورة الخلاص | افتتاح سورة الإخلاص | 1 | non-word |
| 17 | garble | في المفرد القرآنية | في المفردة القرآنية | 1 | non-word |
| 17 | garble | سؤال موضعي | سؤال موضوعي | 1 | «سؤال موضوعي» في السطر 15 |
| 17 | garble | الفاتيح | المفاتيح | 1 | non-word |
| 17 | whisper-hallucination |  شكرا |  | 1 | «شكرا» الأخيرة يولّدها Whisper |

## Speaker slip or ASR (left as is)

- L9 «ابن عمر … لما جمع أشياخ بدر»: the story of the elders of Badr and Surat al-Nasr is Umar's, not Ibn Umar's. Kept as transcribed.
