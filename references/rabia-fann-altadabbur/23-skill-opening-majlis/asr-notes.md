# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 9 | garble | الشخاص | الأشخاص | 1 | non-word |
| 11 | garble | فحازن النبي | فحزن النبي | 1 | non-word |
| 11 | garble | ساب النزول | سبب النزول | 1 | «سبب النزول» مكررة في السطر نفسه |
| 13 | whisper-hallucination |  ترجمة نانسي قنقر |  | 1 | توقيع ترجمة يولّده Whisper على الصمت |

## Notes

- The transcript jumps from the platform intro straight to mid-sentence («وذكرنا أيضا المنهجية»). Either the video starts there or Whisper skipped the greeting; check the audio if it matters.
