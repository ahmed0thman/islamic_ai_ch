# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | منصة زاد |
| 7 | garble | معانا خفية | معان خفية | 1 | السياق |
| 9 | quran | اختلاف كثيرا | اختلافا كثيرا | 1 | النساء 4:82 |
| 9 | quran | يستنبطونهم منهم | يستنبطونه منهم | 1 | النساء 4:83 |
| 9 | garble | أداة عمال الذهن | أداة إعمال الذهن | 1 | «إعمال الفكر» في الدرس 1 |
| 11 | quran | ليتدبر آياته | ليدبروا آياته | 1 | ص 38:29 |
| 13 | whisper-hallucination |  شكرا للمشاهدة شكرا للمشاهدة |  | 1 | جملة يولّدها Whisper على الصمت/الموسيقى في نهاية الملف؛ ليست كلاما |
