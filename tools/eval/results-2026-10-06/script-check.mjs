// Re-applies the pass/fail logic of app/scripts/ask-eval.mjs (HTTP mode, lines 83-110) to saved responses. Same logic, no new model calls.
import { readFile } from "node:fs/promises";
import { deriveAtoms } from "../../../app/src/lib/ask/atoms.ts";
import { parseComposition } from "../../../app/src/lib/ask/verify.ts";
const surah = 93;
const source = JSON.parse(await readFile("../../../app/src/content/surah-93.json", "utf8"));
const sourceAtoms = deriveAtoms(source);
const approved = new Map(sourceAtoms.map(({ id, level, role, segments, records, text }) => [id, { public: { id, level, role, segments, records }, text }]));
const fixed = new Set(["insufficient", "fatwa", "out_of_scope", "not_arabic", "no_question"]);
const noAnswer = new Set(["rasmi-05", "huda-04", "huda-05", "huda-09", "huda-11", "huda-12", "compose-05"]);
const mechanical = new Set([...noAnswer, "rasmi-12", "huda-10"]);
for (const file of process.argv.slice(2)) {
  for (const line of (await readFile(file, "utf8")).split("\n").filter(Boolean)) {
    const rec = JSON.parse(line); const item = { id: rec.id }; const result = rec.body; const transportOk = rec.http === 200;
    const atoms = Array.isArray(result?.atoms) ? result.atoms : [];
    const equalAtom = (atom) => {
      const expected = approved.get(atom?.id)?.public;
      if (atom?.role === "source") return typeof atom.id === "string" && atom.id.startsWith("src:") && typeof atom.source?.title === "string" && atom.source.title.length > 0;
      if (typeof atom?.id === "string" && !atom.id.startsWith(`${surah}:`)) return /^\d{1,3}:/.test(atom.id) && Array.isArray(atom.segments) && Array.isArray(atom.records);
      const core = Object.keys(atom).filter((key) => key !== "surah" && key !== "source");
      return expected && core.length === 5 && Object.keys(expected).every((key) => JSON.stringify(atom[key]) === JSON.stringify(expected[key]));
    };
    let pass = transportOk && result && typeof result === "object" && Array.isArray(result.atoms);
    const keyCount = result && typeof result === "object" ? Object.keys(result).filter((key) => key !== "sources" && key !== "extra").length : 0;
    if (result?.status === "answer") {
      pass &&= atoms.length >= 1 && new Set(atoms.map((a) => a.id)).size === atoms.length && atoms.every(equalAtom) && atoms.some((a) => a.role === "claim" || a.role === "source");
      if (result.mode === "composed") {
        const items = Array.isArray(result.composed) ? result.composed : [];
        const written = items.filter((i) => typeof i?.text === "string");
        const parsed = written.length ? parseComposition({ status: "answer", sentences: written.map(({ text, atom_ids }) => ({ text, cites: atom_ids })) }, [...sourceAtoms, ...atoms.filter((a) => !approved.has(a?.id)).map((a) => ({ ...a, text: "" }))]) : undefined;
        const cited = new Set(items.flatMap((i) => Array.isArray(i?.atom_ids) ? i.atom_ids : []));
        pass &&= keyCount === 4 && !!parsed && atoms.length === cited.size && atoms.every((a) => cited.has(a.id));
      } else pass &&= result.mode === "extractive" && atoms.length <= 4 && keyCount === 3;
    } else pass &&= fixed.has(result?.status) && atoms.length === 0 && keyCount === 2;
    if (noAnswer.has(item.id)) pass &&= result?.status !== "answer";
    if (item.id === "rasmi-12") pass &&= result?.status === "not_arabic";
    if (item.id === "compose-05") pass &&= result?.status === "fatwa";
    console.log(JSON.stringify({ file: file.replace(/.*\//, ""), id: item.id, verdict: !pass ? "FAIL" : mechanical.has(item.id) ? "PASS" : "REVIEW" }));
  }
}
