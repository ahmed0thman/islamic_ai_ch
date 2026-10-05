import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveAtoms } from "./atoms.ts";
import type { Surah, Segment } from "../types";

const surah: Surah = JSON.parse(await readFile(new URL("../../../../content/export/surah-108.json", import.meta.url), "utf8"));

test("real export atom counts, stable IDs, unchanged segments and record references", () => {
  const atoms = deriveAtoms(surah);
  // The content is rewritten often, so the test checks shape and invariants, not fixed counts.
  assert.ok(atoms.length > 0);
  assert.ok([0, 1, 2, 3].every((level) => atoms.some((atom) => atom.level === level)));
  assert.match(atoms[0].id, /^108:0:blocks\.\d+:\d+$/);
  assert.deepEqual(atoms, deriveAtoms(structuredClone(surah)));
  assert.equal(new Set(atoms.map((atom) => atom.id)).size, atoms.length);
  for (const atom of atoms) {
    assert.equal(atom.segments.at(-1)?.t, "mark");
    assert.ok(atom.records.every((id) => Object.hasOwn(surah.records, id)));
    assert.ok(!atom.text.includes("undefined"));
  }
});

test("duplicates across levels keep the lowest level even when levels are reordered", () => {
  const paragraph = surah.levels[0].blocks.find((block) => block.type === "paragraph")!;
  const copy = structuredClone(surah);
  copy.levels = [3, 1, 0, 2].map((depth) => ({ depth: depth as 0 | 1 | 2 | 3, blocks: [paragraph] }));
  const atoms = deriveAtoms(copy);
  assert.ok(atoms.length > 0);
  assert.ok(atoms.every((atom) => atom.level === 0));
  assert.deepEqual(atoms.map((atom) => atom.segments).flat(), paragraph.segments.slice(0, paragraph.segments.findLastIndex((part) => part.t === "mark") + 1));
});

test("details title, inner paragraphs, consecutive closing markers and ayah text", () => {
  const atom = deriveAtoms(surah).find((item) => item.segments.some((segment) => segment.t === "ayah"))!;
  const mark = atom.segments.at(-1)!;
  const title = atom.segments.filter((part): part is Extract<Segment, { t: "text" | "term" | "mark" }> => ["text", "term", "mark"].includes(part.t));
  const copy = structuredClone(surah);
  copy.levels = [{ depth: 0, blocks: [{ type: "details", title, blocks: [{ type: "paragraph", role: "claim", segments: [...atom.segments, mark] }] }] }];
  const result = deriveAtoms(copy);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "108:0:blocks.0.title:0");
  assert.equal(result[1].id, "108:0:blocks.0.blocks.0:0");
  assert.deepEqual(result[1].segments, [...atom.segments, mark]);
  for (const segment of atom.segments) if (segment.t === "ayah") {
    assert.ok(result[1].text.includes(surah.ayahs.find((ayah) => ayah.key === segment.key)!.text));
  }
});

test("an example paragraph is never a sentence the ask box can choose", () => {
  const copy = structuredClone(surah);
  const before = deriveAtoms(copy).length;
  copy.levels[1].blocks.splice(1, 0, { type: "paragraph", role: "example", segments: [{ t: "text", v: "example text" }] });
  const atoms = deriveAtoms(copy);
  assert.equal(atoms.length, before);
  assert.ok(atoms.every((atom) => !atom.text.includes("example text")));
});
