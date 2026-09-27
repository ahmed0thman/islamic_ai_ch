# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | مقدمة أكاديمية زاد |
| 7 | garble | وعجازه | وإعجازه | 1 | non-word |
| 7 | garble | لعجاز القرآن | لإعجاز القرآن | 1 | non-word |
| 7 | garble | وبلغته الكاملة | وبلاغته الكاملة | 1 | «وبلاغته» في السطر نفسه |
| 7 | garble | البئيدة | البعيدة | 1 | non-word |
| 11 | quran | ربي ابني لي عندك بيتا | رب ابن لي عندك بيتا | 1 | التحريم 66:11 |
| 13 | garble | سلوب فيه | أسلوب فيه | 1 | non-word |
| 13 | garble | همية | أهمية | 1 | non-word |
| 13 | garble | فسليب | فأساليب | 1 | non-word; «أساليب» في السطر نفسه |
| 13 | garble | بسليب | بأساليب | 1 | non-word |
| 15 | whisper-hallucination |  شكرا |  | 1 | «شكرا» الأخيرة يولّدها Whisper |
