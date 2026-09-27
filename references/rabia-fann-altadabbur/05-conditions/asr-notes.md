# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | منصة زاد |
| 7 | garble | أن نجأل | أن نجعل | 1 | non-word |
| 11 | garble | أردت تدبر الحقيقي | أردت التدبر الحقيقي | 1 | السياق |
| 11 | garble | تصمد إليه الخلاق | تصمد إليه الخلائق | 1 | تفسير الصمد |
| 11 | garble | السؤد التام | السؤدد التام | 1 | تفسير الصمد |
| 13 | garble | دلالات أصورية | دلالات أصولية | 1 | non-word |
| 13 | garble | علم وآدات | علم وأدوات | 1 | non-word |
| 13 | garble | مجال للنقجدال | مجالا للجدال | 1 | non-word |
| 15 | garble | فيما يتألق بالتدبر | فيما يتعلق بالتدبر | 1 | السياق |
| 15 | garble | والأمل الصالح | والعمل الصالح | 1 | الدعاء المعروف |
| 15 | whisper-hallucination |  ترجمة نانسي قنقر |  | 1 | سطر يولّده Whisper على الصمت في نهاية الملف؛ ليس كلاما |
