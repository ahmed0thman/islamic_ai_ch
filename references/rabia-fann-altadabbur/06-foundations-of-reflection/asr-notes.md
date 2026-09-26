# ASR correction ledger

Method: `.claude/rules/transcript-cleanup.md` (domain `islamic-tadabbur`). Line numbers match `transcript.raw.md`.

## Applied fixes

| line | class | was | now | × | reason |
|---|---|---|---|---|---|
| 7 | name | منصة زادي | منصة زاد | 1 | منصة زاد |
| 9 | garble | في نفوسها أو لا أن | في نفسك أولا أن | 1 | «ثم في نفوس طلابك» بعدها |
| 9 | garble | أو تسورة المسد | أو سورة المسد | 1 | non-word |
| 11 | hadith | تب لك لهذا جمعتنا | تبا لك ألهذا جمعتنا | 1 | قول أبي لهب في الصحيحين |
| 11 | garble | بإذن لا إلى | بإذن الله إلى | 1 | السياق |
| 11 | garble | سورة الأخلاص قضية الأخلاص نتواصل بالأخلاص | سورة الإخلاص قضية الإخلاص نتواصى بالإخلاص | 1 | «التواصي» قبلها |
