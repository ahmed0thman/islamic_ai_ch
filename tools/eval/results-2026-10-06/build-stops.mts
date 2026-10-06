// Scratchpad variant: lists stop-title questions (verbatim) per surah with the stop's own atoms as gold. No DB, no network.
import { readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error
import { deriveAtoms, readerUnits } from "../../../app/src/lib/ask/atoms.ts";
const root = process.env.HUDA_ROOT ?? "<repo-root>";
const existing = JSON.parse(readFileSync(`${root}/tools/data/eval/retrieval_cases.json`, "utf8")).cases;
const surahs = [93,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114];
const out: any[] = [];
for (const no of surahs) {
  const s = JSON.parse(readFileSync(`${root}/app/src/content/surah-${no}.json`, "utf8"));
  const atoms = deriveAtoms(s);
  for (const depth of [0,1,2,3] as const) {
    const units = readerUnits(s, depth);
    for (const u of units) {
      const gold = atoms.filter((a: any) => !String(a.id).includes(":term:") && a.level === depth).filter((a: any) => a.locations.some((l: any) => l.depth === depth && l.stops.includes(u.number))).map((a: any) => a.id);
      out.push({ surah: no, depth, number: u.number, kind: u.kind ?? "stop", title: u.title, gold, text_is_gold: atoms.some((a: any) => gold.includes(a.id) && a.text.trim() === u.title.trim()) });
    }
  }
}
writeFileSync((process.env.HUDA_OUT ?? ".") + "/stops-all.json", JSON.stringify(out, null, 1));
// validation against existing stop_title cases
let same = 0, diff = 0, notfound = 0; const bad: string[] = [];
for (const c of existing.filter((x: any) => x.kind === "stop_title")) {
  const m = out.filter((o) => o.surah === c.surah && o.depth === c.depth && o.title === c.question);
  if (!m.length) { notfound++; bad.push(c.id + ":nf"); continue; }
  const ok = m.some((o) => JSON.stringify(o.gold) === JSON.stringify(c.gold_atoms));
  if (ok) same++; else { diff++; bad.push(c.id + `:d${c.depth}:${m[0].kind}`); }
}
console.log({ total_units: out.length, same, diff, notfound, bad });
