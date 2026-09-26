# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 9 | garble | التدبر المإيماني | التدبر الإيماني | 1 | non-word |
| 9 | garble | هذه الفتيح | هذه المفاتيح | 1 | non-word; «مفاتيح» قبلها |
| 9 | garble | لطالب الإلم | لطالب العلم | 1 | «طالب العلم» في السطر 11 |
| 9 | garble | وأنه إقاش | وأنه نقاش | 1 | non-word; «الحوار والنقاش» بعدها |
| 11 | garble | راء مشتركة | آراء مشتركة | 1 | non-word |
| 13 | garble | ونأوصي | ونوصي | 1 | non-word |
| 13 | garble | يتدرسون | يتدارسون | 1 | non-word |
| 15 | garble | الله أزجال | الله عز وجل | 1 | non-word; لازمة المتكلم |
| 15 | quran | ولا تستوي الحسن ولا | ولا تستوي الحسنة ولا | 1 | فصلت 41:34 |
| 15 | garble | والخوات | والأخوات | 1 | non-word |
| 17 | garble | وتقرحاتكم | ومقترحاتكم | 1 | non-word |
| 17 | name | منصة زادي | منصة زاد | 1 | أكاديمية زاد |
| 19 | garble | وبرك الله | وبارك الله | 1 | non-word |
| 19 | garble | يتبرغ لقلب العلم | يتفرغ لطلب العلم | 1 | «التفرغ لطلب العلم» في السطر نفسه |
| 19 | garble | كبلى | كبرى | 1 | non-word; «نعمة كبرى» قبلها |
| 19 | garble | وكجر فيه | وكثر فيه | 1 | non-word |

## Uncertain (left as transcribed)

- L7 `التدبر مهتام`: unclear; the contrast it draws (tafsir = the scholarly side, tadabbur = iman, action and tazkiya) is stated in the rest of the sentence.
- L11 `تنمل الفكر`: probably «تنمي».
- L15 `قرار الله`: probably «قول الله». `في مجال استدبر وتدار`: probably «في مجال التدبر والتدارس».

## Notes

- L19 after «وبارك الله فيكم جميعا» (~00:07:10) is another speaker: a Zad promo clip on devoting oneself to seeking knowledge («أيها الناس من استطاع منكم أن يتفرغ لطلب العلم…»). It is not part of the lesson; kept because it sits inside the same caption paragraph.
