# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 9 | garble | لللفظ | للفظ | 1 | non-word |
| 9 | garble | بإبارة | بعبارة | 1 | non-word |
| 9 | garble | وأنفائها | وأنفعها | 1 | عبارة السعدي «من أجل قواعد التفسير وأنفعها» |
| 9 | garble | تستدئي | تستدعي | 1 | «وتستدعي» في السطر نفسه |
| 11 | garble | وفي حكام لازمة | وفي أحكام لازمة | 1 | «أحكام لازمة» بعدها مباشرة |
| 13 | quran | الذين أمروا كتب | الذين آمنوا كتب | 1 | البقرة 2:183 |
| 13 | garble | وركم من أركان | وركن من أركان | 1 | non-word |
| 15 | garble | ودللته | ودلالته | 1 | non-word |
| 15 | whisper-hallucination |  ترجمة نانسي قنقر |  | 1 | توقيع ترجمة يولّده Whisper على الصمت |

## Uncertain (left as transcribed)

- L11 `تستنطيقه`: likely تستنبطه or تستنطقه; the step it describes is still clear.
