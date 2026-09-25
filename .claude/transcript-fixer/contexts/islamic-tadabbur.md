# Domain context — islamic-tadabbur

**Business context.** Recorded Arabic lectures and lessons on Quran reflection (tadabbur),
tafsir, and related sciences, pulled as YouTube auto-captions (`ar-orig`) or other ASR.
Speech is **Egyptian colloquial Arabic** interleaved with **recited Quran**, **quoted hadith**
(Classical Arabic), names of companions and scholars, and live-audience interjections.
We use these transcripts to study *how* a teacher reflects (links between ayat, events,
hadith, questions the ayah answers) — the method, not the transcript's wording, is the
product. The mushaf and hadith sources are authoritative for quoted text, never the ASR.

## YouTube auto-caption orthography — NOT errors, never "fix"

The engine normalizes spelling consistently. Leave all of this as delivered:
- `ة` → `ه` (`سوره`, `الصلاه`), `ى` → `ي`, `أ/إ/آ` → `ا`, hamza dropped (`شا الله`, `يومر`).
- No punctuation; occasional `؟`. Do not add punctuation.
- `>>` = a speaker turn the engine detected (usually audience). Never add, move, or remove.
- `[ضحك]`, `[تنحنُح]`, `[أصوات شخير]`… = the engine's sound tags. `[أصوات شخير]` is its
  label for background noise, not literal snoring. Leave tags in place.
- Egyptian colloquial, stutters, repetitions, fillers (`اا`, `يعني`, `ماشي`) are speech. Keep.

## The dominant high-value error class: garbled Quran quotations

Recited ayat are where ASR errors change meaning *and* where the text can be proven.
Run `python3 tools/quran_scan.py <transcript>` — it locates every quotation and shows the
mushaf words just outside each match; a near-miss there is almost always ASR.

Confirmed examples (ihdina-fatiha series, 2026-09-25):
- `نون والقلم يسترون` → `نون والقلم وما يسطرون` (68:1) — dropped word + س/ص.
- `تبت ت يد ابي لهب` / `تبت يد ابي لهب` → `تبت يدا ابي لهب` (111:1).
- `لاجل غير ممنون` → `لاجرا غير ممنون` (68:3).

Policy: when the speaker is clearly reciting (a run of mushaf words around the garble),
restore the mushaf wording **in the transcript's normalized orthography** (no tashkeel,
`ه` for `ة`). Do not "complete" an ayah the speaker cut short, and do not insert ayah
words he skipped — only fix what ASR misheard. The spoken letter name `نون` for `ن` is
what he said; keep it.

## Hadith and athar

- Fix a hadith word only when the wording is well known and the garble is near-sound
  (`حس` in Talha's hadith is *correct* — it is the actual word, not an error).
- Everything else: leave it and queue it. Hadith wording must later be verified against a
  collection anyway; the transcript is never a hadith source.
- Known garble: Abu Lahab's `تبا لك سائر اليوم الهذا جمعتنا` arrives fused/reordered
  (`مش كدهذا جمعتنا تبا لك سائرا`). Reconstruct only if the order is clear from audio;
  otherwise queue.

## Traps — context only, never dictionary rules

- **`س` ↔ `ص`**: `الصور` for `السور` ("the surahs" — the series is about surahs/ayat that
  recur). Both are real words: `صوره` can be a real "picture". Judge per sentence.
- **`ايه`** is BOTH `آية` (ayah) and Egyptian `إيه` ("what") in this orthography. It is the
  engine's correct normalization of both. Never change it.
- **`ق` ↔ `ك`/`ء`**: Egyptian speakers pronounce `ق` as hamza, so ASR drops or swaps it
  (`تقرا اسماعم` = `تقرع اسماعهم`). Real-word collisions are common → per-sentence only.
- **`ش` ↔ `س`**, **`ذ` ↔ `ز`/`د`**, **`ث` ↔ `س`/`ت`**, **`ظ` ↔ `ض`/`ز`**: Egyptian
  pronunciation of Classical words. In colloquial passages the colloquial form is
  correct (`تاني`, `كده`); only inside quotations restore the Classical form.
- **`الحمد لله رب`** and other Fatiha phrases recur hundreds of times in a Fatiha series
  as ordinary speech — the citation scanner reports them; they need no action.
- **`صوره` / `الصور` is not always `سوره`.** In the ihdina-fatiha series ~25 of them
  were `سوره` (context: a surah that is recited/revealed/obligatory), but ep 3 line 54
  `كل الصور اللي احنا قلناها` = "all the *forms*" (ways of doing ruqya) and ep 5
  `ملك صوري` = "nominal ownership". Read each sentence; never replace_all across files.
- **`الم` = `القلم`** (Egyptian ق→ء: *al-alam*) in ep 2 — proven by `القلم لاحمد` in the
  same paragraph. `الم` is also a real word (pain, and the letters الم) → never a rule.
- **`ارى` = `رقى`** (ruqya), same ق→ء mechanism. `ارى` is a real word → context only.
- **`معنا` = `معنى`** in «تم حسا … لا يتم معنى». Real word collision → context only.

## Recurring non-word garbles (safe dictionary candidates)

These are non-words or fused forms, seen more than once, with a single reading:
- `اكلمنا` → `اتكلمنا` (ep 2, ep 5).
- `بقىي` / `بقىنا` / `بالنا` (time sense) → `بقالي` / `بقالنا` — the engine splits «بقالي».
- `بقىاني` → `بقى تاني`; `معنىاني` → `معنى تاني` — «تاني» fused onto the previous word.
- `هنجي لله` / `هنجي للهبعدين` → `هنجي له` / `هنجي له بعدين` — the lecturer's refrain
  "we'll come to it". NOTE `لله` is a real word; only the `هنجي لله` collocation is safe.
- `ومنه` / `ومن ولاه` / `ومن والاولاه` after `وصحبه` → `ومن والاه` (opening formula).
- Digit-glyph garbles: `2ين` اتنين, `4عه` اربعه, `3لاه`/`لاثه` تلاته, `8انيه` تمانيه,
  `انين 3لا` اتنين تلاته.

## Speaker slips — record, never correct

- ep 5 line 28: «زي ما ابو طالب قال … انا رب الابل» — the saying is Abd al-Muttalib's.
  This is what was said; the transcript keeps it and the ledger notes it.

## Authoritative sources

- Mushaf text: `tools/data/quran-simple-clean.json` (Tanzil simple-clean), via
  `tools/quran_scan.py`.
- Series metadata, episode list, cut points: `references/<series>/README.md`.
- Project scope and terminology: `PROJECT_VISION.md`.
- WebSearch is acceptable for public entities (a companion's name, a book of tafsir, a
  scholar) — these are public, unlike the internal names in other domains.

## People

Speakers are not identified by the captions. Do not guess the lecturer's name into the text.
Companion and scholar names are public entities — verify by sound + context + WebSearch.
