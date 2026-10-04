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
  "title": "…",                                            // optional. A short question (at most 8 words). A titled paragraph is a STOP on the surah map
  "ayahs": ["108:1"],                                      // optional in the nasij source; always present on a stop in the export: the ayah station(s) the stop hangs from
  "passage": "p1",                                         // optional: the passage this block belongs to (see `passages`)
  "segments": [ /* Segment */ ] }
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
  "status_text": "…",                     // ready sentence describing the state; may be empty
  "depth_min": 0,
  "ayah_keys": ["108:1"],                 // the ayahs this record is about; links stops to ayah stations
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
- A `details` title follows the rules of a claim paragraph; its inner blocks follow the rules of their own role. `details` do not nest.
- Every `ayah.key` and `ayah.keys[]` exists in `ayahs`.
- A record with badge `la_yathbut` or `khilaf_mutabar` shows the badge next to the marker in the text and in the panel; `thabit` shows in the panel only.
- Level `n` shows the blocks of `levels[n]` only (levels are complete texts, not increments).
- The surah map is drawn from the level's blocks: ayah stations in order, and under each station the stops whose `ayahs` start there. An untitled paragraph belongs to the stop before it (same scene). Changing the level redraws the same map with that level's stops. Nothing on the map is generated: every stop is a paragraph with its markers.
- A stop's `title` is system text (no Quran text in it) and claims nothing beyond what its paragraph's records carry.

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

The exporter adds `ayahs` from the King Fahd Complex file and the public `records` map from `.cache/records/<no>/records.v2.json`, then refuses the whole surah if any check fails.
