# Content contract (app <- content)

The app renders only what is in `content/`. It never writes Arabic text itself.

- `content/ui.ar.json`: every fixed Arabic UI string (level names, icon and badge labels, disclosure, privacy line, fixed phrases).
- `content/export/index.json`: `{ "surahs": [ { "no": 108, "name": "…", "ayah_count": 3 } ] }`.
- `content/export/surah-<no>.json`: one surah, produced by the exporter from verified records. Shape:

```jsonc
{
  "schema": 1,
  "fixture": false,                       // true only for placeholder data
  "surah": { "no": 108, "name": "…", "ayah_count": 3 },
  "ayahs": [ { "key": "108:1", "no": 1, "text": "…" } ],   // Quran text, from the King Fahd Complex file
  "passages": [ { "id": "p1", "from": "93:1", "to": "93:5",  // optional. Consecutive ayah ranges that cover the surah with no gap and no overlap
                  "title": "…", "records": ["93-r20"] } ],  //   the division is a scholar's, carried by its records; absent = the whole surah is one passage
  "levels": [ { "depth": 0, "blocks": [ /* Block */ ] } ],   // depth 0..3, always four entries
  "records": { "108-r06": { /* Record */ } }
}
```

`Block` is one of:

```jsonc
{ "type": "heading", "text": "…" }
{ "type": "heading", "text": "…", "kind": "question" }     // a question the next paragraph answers (the question never stands without its answer). It claims nothing, so it has no marker
{ "type": "ayah", "keys": ["108:1", "108:2"] }             // displayed Quran text, taken from `ayahs`
{ "type": "paragraph",
  "role": "claim" | "transmission",                        // transmission = quoted narration shown as-is, never restyled
  "title": "…",                                            // optional. A short title, a question or a noun phrase (at most 8 words). A titled paragraph is a STOP on the surah map
  "kind": "misconception",                                 // optional, on a stop only: the stop corrects a common misreading or answers an objection. Its title is a question, its paragraph answers from its records; the app shows a badge and a side path that returns to the reading (decision 027). NOT accepted by the exporter yet (C16 allows "summary" only)
  "ayahs": ["108:1"],                                      // optional in the nasij source; always present on a stop in the export: the ayah station(s) the stop hangs from
  "passage": "p1",                                         // optional: the passage this block belongs to (see `passages`)
  "segments": [ /* Segment */ ] }
{ "type": "paragraph", "role": "example",                  // an everyday example in the explainer's manner (decision 076). System wording that illustrates and proves nothing:
  "segments": [ { "t": "text", "v": "…" } ] }              //   `text` segments only (no mark, quote, ayah or term), no `title`, no `ayahs`. The app prints the fixed label ui.ar.json -> example.label above it
{ "type": "paragraph", "role": "claim", "kind": "summary", // the surah in one look (owner's note, 5 Oct): the closing synthesis of a level, shown on its own closing screen
  "segments": [ /* Segment */ ] }                          //   before the link to the next surah. A claim paragraph like any other (markers, records), with no `title` and no `ayahs`
{ "type": "details",                                       // an item that opens on tap; closed by default
  "title": [ /* Segment: text | term | mark */ ],          // carries the short answer; it is a claim, so it ends with a mark
  "blocks": [ /* paragraph blocks only */ ] }
```

`Segment` is one of:

```jsonc
{ "t": "text", "v": "…" }                                   // system wording
{ "t": "ayah", "key": "108:1" }                             // inline Quran text, rendered from `ayahs`, visually distinct
{ "t": "quote", "v": "…", "record": "108-r27" }             // verbatim source text, visually distinct from system wording
{ "t": "mark", "records": ["108-r06"] }                     // marker after a claim; shows the icons of its records; opens the panel
{ "t": "term", "v": "…", "record": "108-r41" }              // a term of the sciences, shown as a link inside system wording; opens the panel on its record, whose `claim` is the term's short definition
```

`Record`:

```jsonc
{
  "id": "108-r06",
  "icons": ["scholar"],                   // keys of ui.ar.json -> icons, in legend order
  "badge": null,                          // null | "thabit" | "la_yathbut" | "khilaf_mutabar"
  "claim": "…",
  "status_text": "…",                     // ready sentence(s) describing the state, one per line; may be empty. Holds the reason a record is
                                          //   suspended or shown in level 3 only, and the record's `status_note` (decision 083): what the woven
                                          //   text does not say about the state of the information
  "state": "report_unjudged",             // optional (decision 083). A closed key for a state that the badge does not say, so that the marker
                                          //   itself can show it. Present only with a nonempty `status_text`. Values:
                                          //   "report_unjudged" = a historical or sira report carried by a scholar's statement alone, with no
                                          //   graded narration (decisions 079, 080): his statement is verified in his book, the report is not judged
                                          //   The app indexes ui.ar.json -> states by this key and breaks on a key it does not know, so a new value
                                          //   is exported only after the app and ui.ar.json carry it (see "Records with no badge" below)
  "depth_min": 0,
  "ayah_keys": ["108:1"],                 // the ayahs this record is about; links stops to ayah stations
  "science": "balagha",                   // optional, term records only: a key of ui.ar.json -> sciences, the science the term belongs to. Absent or null on other records
  "evidence": [
    { "icon": "scholar",
      "source_title": "…", "author": "…", "locator": "…",
      "quote": "…",                       // short, at most 200 characters
      "url": null,                        // string or null
      "rulings": [ { "text": "…", "ruler": "…", "where": "…" } ],
      "link_strength": null }             // null or a key of ui.ar.json -> link_strength
  ]
}
```

Rules the app relies on:

- Every `mark.records[]`, `quote.record` and `term.record` id exists in `records`.
- A `term` is not a marker: the sentence it sits in still ends with its own `mark`. Its record needs the same build and display permission as a claim's record.
- A term's panel shows three things from its record: the plain meaning (`claim`), the scholar's sentence that uses the term (`evidence[].quote`), and the science it belongs to (`science`, a fixed classification like the source icons, never generated text).
- An `example` paragraph: levels 1 and 2 only; at most one per level; at most two sentences; never the first block of a level and always directly after a `claim` or `transmission` paragraph (it belongs to that stop's scene); never inside `details`. It carries no marker because it claims nothing: any conclusion about the ayah is a separate claim paragraph with its record. It never likens God's act or the Prophet's state to ours (checked by the reviewer, not by the exporter).
- A `summary` paragraph: at most one per level, always the last block of the level, never a stop and never inside `details`. It gathers what the level already said (the surah's parts in order, its purpose, how its end answers its beginning); a recap in words the level already used is frame wording, and anything new is a claim with its marker. The app draws the closing screen from it together with `passages` (their titles, in order) and the level's terms.
- A `details` title follows the rules of a claim paragraph; its inner blocks follow the rules of their own role. `details` do not nest.
- Every `ayah.key` and `ayah.keys[]` exists in `ayahs`.
- A record with badge `la_yathbut` or `khilaf_mutabar` shows the badge next to the marker in the text and in the panel; `thabit` shows in the panel only.
- The text carries the meaning; the marker and its record carry the source and the state (decision 083, the owner's rule: brevity, not removal).
  - A scholar's name stays in the text where it helps the reader, in its shortest form («عند ابن عاشور», «قال السعدي»). A disagreement is told by its holders' names, briefly.
  - No sentence of system wording has the source or the state as its subject (who narrated, in which book, whose wording, that it is the scholar's own statement, why it is weak, that we did not judge it). In the text this is at most a few words inside the sentence that carries the meaning; the detail is in the record: `evidence[]` (source, author, locator, rulings), `badge`, `status_text` and `state`.
  - Whatever state the text does not spell out, the record does. A record with `state` or a nonempty `status_text` is one whose marker should show that state, not only its panel. How the marker shows each state is the app's design.
  - The exporter reports sentences that break this as warning W17 (it never refuses the export): a sentence holding a long status phrase, or more than six words of sayers' names, book titles (both taken from the surah's own records) and transmission vocabulary. Verbatim `quote` segments are not measured.
- Records with no badge: a record whose statement is verified from its sayer but which carries no `thabit` badge, because what is not
  assessed is something else, says so in `status_text` through its `status_note`. Without it the panel shows only the fixed line
  ui.ar.json -> panel.no_badge, which reads as if the statement itself were unverified. Three kinds, one fixed sentence each (written in the
  surah's draft, never by the exporter): an interpretive link (the link is the scholar's own reasoning, its strength is not assessed), a
  purpose of the surah (the purpose is his reasoning), and a view in a disagreement (we did not weigh the views). No `state` is exported for
  them yet. Proposed keys, not adopted and not exported: `link_unrated` for the first two and `tarjih_open` for the third.
- Level `n` shows the blocks of `levels[n]` only (levels are complete texts, not increments).
- The surah map is drawn from the level's blocks: ayah stations in order, and under each station the stops whose `ayahs` start there. An untitled paragraph belongs to the stop before it (same scene). Changing the level redraws the same map with that level's stops. Nothing on the map is generated: every stop is a paragraph with its markers.
- A stop's `title` is system text and claims nothing beyond what its paragraph's records carry. It holds no Quran text, except the single Quran word the title asks about, written between «». Two or more consecutive Quran words never appear in a title or in a `text` segment; they go in an `ayah` segment.

## Nasij source (`content/nasij/<no>.json`)

Written by the content agents, read by `tools/export_content.py`. It holds our own wording only, never book text beyond short verbatim quotes that already exist in a record.

```jsonc
{
  "surah": 108,
  "style": "default",
  "levels": [ { "depth": 0, "blocks": [ /* Block, same shapes as above */ ] } ],   // depth 0..3
  "held": [ { "depth": 1, "block": { /* Block */ }, "reason": "…" } ]            // written but not exported: no record permits it yet
}
```

The exporter adds `ayahs` from the King Fahd Complex file and the public `records` map from `.cache/records/<no>/records.v2.json`, then refuses the whole surah if any check fails. A private record's optional `state` is copied as it is, and its `status_note` becomes a line of `status_text`; both are written with the record in the surah's draft and never generated by the exporter.
