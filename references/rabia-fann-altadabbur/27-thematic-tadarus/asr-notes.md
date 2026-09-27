# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 9 | garble | موضوعات مؤينة | موضوعات معينة | 1 | non-word |
| 11 | name | اء العمران | آل عمران | 1 | non-word; اسم السورة |
| 11 | name | سورة الأمران | سورة آل عمران | 1 | non-word; اسم السورة |
| 11 | quran | أرف لا ميم الله لا إله | ألف لام ميم الله لا إله | 1 | آل عمران 3:1-2 (أسماء الحروف كما نُطقت) |
| 13 | name | في قصة القرنين | في قصة ذي القرنين | 2 | ذو القرنين، الكهف |
| 13 | garble | آدابة المجالس | آداب المجالس | 1 | non-word; «آداب عظيمة» في السطر نفسه |
| 13 | garble | اجتملت | اشتملت | 1 | non-word |
| 17 | garble | وبرك الله | وبارك الله | 1 | non-word |

## Uncertain (left as transcribed)

- L11 `مناسبة قصة وحود`: perhaps «قصة أحد» (the Battle of Uhud occupies a large part of Aal Imran).

## Notes

- As in lesson 23, the transcript jumps from the platform intro to mid-sentence («وخطواته ذكرنا»).
