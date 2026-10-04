# Review brief: surah {{surah_no}} (read-only)

You are an independent reviewer. Do not edit any file. You review work written by another model.

Product core: "Huda" guides a non-specialist reader through a surah's meaning. Every sentence shown to the reader must be carried by a verified record (claim + verbatim evidence quote + source locator + named gradings + build/display permission). The AI never generates an ayah or a meaning and never grades a narration. A sentence that no record carries must not be shown.

Read: `content/SCHEMA.md`, `docs/06-product/record-schema.md`, the private records `.cache/records/{{surah_no}}/records.v2.json`, the woven text `content/nasij/{{surah_no}}.json`, and use `python3 -B tools/retrieve.py --id <passage id>` / `--ayah {{surah_no}}:N` to open the sources and verify quotes in context.

Check a SAMPLE, chosen by you and listed in the report: all of level 0 and level 1, at least 8 sentences of level 2, at least 4 depth items of level 3, every stop title, every passage, every term, and every narration whose build permission is «نعم».

For each sampled item decide:
1. SUPPORT: do the cited records actually carry what the sentence/title says (nothing added, generalised, or made more certain than the source)?
2. ATTRIBUTION: is the statement attributed to the right author, and is the author's wording not cut in a way that changes its meaning?
3. QUOTE: is every `quote` segment verbatim from its record's evidence?
4. NARRATIONS: is any narration used as the basis of a constructed sentence without build permission «نعم»? Is a sira/historical report stated on a scholar's word alone?
5. QURAN: any Quran wording inside system text or titles?
6. READER: does each level open in a way that makes a stranger want to continue (not necessarily a question), are stop titles clear and short, is each question answered where it appears, is level 0 short?

Return, as the LAST thing in your report, one fenced JSON block exactly in this shape (numbers are integers; severities are "critical", "major", "minor"):

```json
{
  "surah": {{surah_no}},
  "sampled": {"sentences": 0, "titles": 0, "terms": 0, "narrations": 0, "depth_items": 0},
  "scores": {"support": 0, "attribution": 0, "quote_fidelity": 0, "narration_handling": 0, "reader_pull": 0},
  "findings": [
    {"severity": "major", "level": 1, "where": "block index or title", "records": ["{{surah_no}}-r00"], "problem": "…", "fix": "…"}
  ],
  "verdict": "ship" 
}
```

Scores are 0–5 (5 = no problem found in the sample). `verdict` is one of "ship", "fix-then-ship", "do-not-ship" ("do-not-ship" whenever a critical finding exists: an unsupported meaning, a wrong attribution, a fabricated or altered quote, or a pending narration used as a basis). Before the JSON, write a short prose summary in English. Quote Arabic only as short excerpts needed to identify the spot.
