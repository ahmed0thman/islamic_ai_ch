# Review brief: surah {{surah_no}} (read-only)

You are an independent reviewer. Do not edit any file. You review work written by another model.

Product core: "Huda" guides a non-specialist reader through a surah's meaning. Every sentence shown to the reader must be carried by a verified record (claim + verbatim evidence quote + source locator + named gradings + build/display permission). The AI never generates an ayah or a meaning and never grades a narration. A sentence that no record carries must not be shown.

Read: `content/SCHEMA.md`, `docs/06-product/record-schema.md`, the private records `.cache/records/{{surah_no}}/records.v2.json`, the woven text `content/nasij/{{surah_no}}.json`, and use `python3 -B tools/retrieve.py --id <passage id>` / `--ayah {{surah_no}}:N` to open the sources and verify quotes in context.

Check, and list in the report what you checked: ALL of level 0, level 1 and level 2 (every sentence, no sampling); in level 3 every depth-item title and at least half of the depth items (all of them when there are eight or fewer), every stop title, every passage, every term, and every narration whose build permission is «نعم».

VOICE (frame sentences): the weave may contain short frame sentences written by the system with no record: a question, a lead-in, pointing at what is visible in the displayed ayah, a sequence link, a recap in words already used, addressing the reader, or an everyday example explicitly labelled as illustration. A frame sentence is NOT an `unsupported` finding. Test each one: delete it; if the reader loses a piece of information about which one could ask "who said this?", it is a claim and needs a record (finding, kind `unsupported`); if the reader only loses direction for the eye, it is a frame. A frame that smuggles a claim (a question presupposing a fact, a causal link such as "because"/"therefore", an explanation, a described feeling of the people the ayah came to) is a finding. If `.cache/records/{{surah_no}}/weave-frames.json` exists it lists the intended frame sentences; check each against this test. Plain-language paraphrase of a record's evidence, without the scholar's name in the sentence, is acceptable when the mark carries the record and nothing is added, generalised or made more certain.

EXAMPLE paragraphs (`"role": "example"`, decision 076): system-written everyday illustrations with no record and no marker; the app labels them as illustration, not evidence. They are not `unsupported` findings. Report a finding (kind `other`, severity `major`) when an example: likens God's act or the Prophet's state to anything in our lives; ends with or implies a conclusion about the ayah's meaning; states a fact about the ayah, its revelation or its people; or is longer than two sentences.

TERM notes: a term's record gives the plain meaning (`claim`), a definition quoted from a terminology book when one exists, the scholar's sentence that uses the term in this surah, and `science` (a fixed classification). Check that the plain meaning says no more than the quoted definition, that the term is really what the scholar's sentence is about, and that the science fits the term (a wrong science is a `minor` finding, kind `attribution`). In the text the plain meaning must come before the term's name.

PLAIN LANGUAGE: a word must not be explained by a harder word. When a gloss or paraphrase is plainer than the source wording, check that it does not add or lose meaning against the record's evidence (finding kind `unsupported` when it does).

For each sampled item decide:
1. SUPPORT: do the cited records actually carry what the sentence/title says (nothing added, generalised, or made more certain than the source)?
2. ATTRIBUTION: is the statement attributed to the right author, and is the author's wording not cut in a way that changes its meaning?
3. QUOTE: is every `quote` segment verbatim from its record's evidence?
4. NARRATIONS: is any narration used as the basis of a constructed sentence without build permission «نعم»? A sira/historical report carried by a scholar's word with no graded narration is judged by the owner's rule (decisions ق-079, ق-080), not rejected outright:
   - ACCEPTABLE in levels 1-2 when the ayah itself attests the underlying event (it denies something that was said, or affirms a favour or a state) AND the sentence is explicitly attributed to the scholar AND a disclosure sentence says it is his statement, not a graded narration.
   - ACCEPTABLE in level 3 only (details), attributed, with the phrase «لم نحكم على ثبوته», when the ayah does not attest the event, or when the report affirms a merit or a prophetic distinction.
   - CRITICAL when: an unattributed sentence is built on such a report; it appears in level 0; a report the ayah does not attest, or a merit/distinction report, appears in levels 0-2; the attribution or the disclosure is missing.
5. QURAN: any Quran wording inside system text or titles? (A single Quran word named as the word under discussion, such as a lemma in a question title, is allowed. Two or more consecutive Quran words in system text or a title are a finding.)
6. READER: does each level open in a way that makes a stranger want to continue (not necessarily a question), are stop titles clear and short, is each question answered where it appears, is level 0 short?

Return, as the LAST thing in your report, one fenced JSON block exactly in this shape (numbers are integers; severities are "critical", "major", "minor"):

```json
{
  "surah": {{surah_no}},
  "sampled": {"sentences": 0, "titles": 0, "terms": 0, "narrations": 0, "depth_items": 0},
  "scores": {"support": 0, "attribution": 0, "quote_fidelity": 0, "narration_handling": 0, "reader_pull": 0},
  "findings": [
    {"kind": "unsupported", "severity": "major", "level": 1, "where": "block index or title", "records": ["{{surah_no}}-r00"], "problem": "…", "fix": "…"}
  ],
  "verdict": "ship" 
}
```

Scores are 0–5 (5 = no problem found in the sample). `verdict` is one of "ship", "fix-then-ship", "do-not-ship" ("do-not-ship" whenever a critical finding exists: an unsupported meaning, a wrong attribution, a fabricated or altered quote, or a pending narration used as a basis). Before the JSON, write a short prose summary in English. Quote Arabic only as short excerpts needed to identify the spot.

Each finding must include `kind`: "unsupported", "attribution", "quote", "narration", "opening", "review-status", or "other". Use "review-status" for systemic completion status issues (such as records awaiting human review) that the builder cannot fix. These remain in the verdict and report, but are excluded from builder repair rounds. Use the content kinds for problems the builder can fix; do not classify an unsupported sentence or definition as "review-status".
