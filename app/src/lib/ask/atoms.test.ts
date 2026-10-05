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
  // Segments are unchanged except that stray punctuation at the very start of a sentence is stripped (a reference loop, independent of the implementation).
  let atStart = true;
  const expected: Segment[] = [];
  for (const part of paragraph.segments.slice(0, paragraph.segments.findLastIndex((part) => part.t === "mark") + 1)) {
    if (part.t === "text" && atStart) {
      const v = part.v.replace(/^[\s.\u060C\u061B:\u061F!\u2026]+/, "");
      if (v) { expected.push({ ...part, v }); atStart = false; }
    } else { expected.push(part); atStart = part.t === "mark"; }
  }
  assert.deepEqual(atoms.map((atom) => atom.segments).flat(), expected);
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

test("stray punctuation at the start of an atom's first text segment is stripped; nothing else changes", () => {
  const word = String.fromCodePoint(0x627, 0x628, 0x62C), other = String.fromCodePoint(0x62F, 0x647, 0x648);
  const marks = [0x2E, 0x60C, 0x61B, 0x3A, 0x61F, 0x21, 0x2026].map((code) => String.fromCodePoint(code));
  const mark: Segment = { t: "mark", records: [] };
  const key = surah.ayahs[0].key;
  const build = (...paragraphs: Segment[][]) => {
    const copy = structuredClone(surah);
    copy.levels = [{ depth: 0, blocks: paragraphs.map((segments) => ({ type: "paragraph" as const, role: "claim" as const, segments })) }];
    return deriveAtoms(copy);
  };
  const [stripped] = build([{ t: "text", v: ` ${marks.join(" ")}  ${word}.` }, mark]);
  assert.deepEqual(stripped.segments, [{ t: "text", v: `${word}.` }, mark]);
  assert.equal(stripped.text, `${word}.`);
  assert.equal(stripped.id, "108:0:blocks.0:0");
  for (const lead of marks) assert.equal(build([{ t: "text", v: `${lead} ${word}` }, mark])[0].text, word);
  // A segment that becomes empty is dropped and the next text segment is cleaned in turn; an ayah or term first segment is left alone.
  assert.deepEqual(build([{ t: "text", v: ". " }, { t: "text", v: `${marks[1]} ${other}` }, mark])[0].segments, [{ t: "text", v: other }, mark]);
  const ayahFirst: Segment[] = [{ t: "ayah", key }, { t: "text", v: `. ${word}` }, mark];
  assert.deepEqual(build(ayahFirst)[0].segments, ayahFirst);
  // The strip never reaches past the first segment, and clean atoms come out byte-identical, two in a row included.
  const clean: Segment[][] = [[{ t: "text", v: `${word} ${other}.` }, mark], [{ t: "text", v: `${other}, ${word}.` }, { t: "text", v: `. ${other}` }, mark]];
  const atoms = build(...clean);
  assert.deepEqual(atoms.map((atom) => atom.segments), clean);
  assert.deepEqual(atoms.map((atom) => atom.text), [`${word} ${other}.`, `${other}, ${word}.. ${other}`]);
  assert.deepEqual(atoms.map((atom) => atom.id), ["108:0:blocks.0:0", "108:0:blocks.1:0"]);
  // A second sentence of one paragraph that starts with the previous full stop loses it and keeps its id.
  const two = build([{ t: "text", v: word }, mark, { t: "text", v: `. ${other}` }, mark]);
  assert.deepEqual(two.map((atom) => atom.text), [word, other]);
  assert.deepEqual(two.map((atom) => atom.id), ["108:0:blocks.0:0", "108:0:blocks.0:1"]);
  // The real export carries no leading stray punctuation in any atom.
  for (const atom of deriveAtoms(surah)) {
    const first = atom.segments[0];
    if (first.t === "text") assert.ok(!/^[\s.\u060C\u061B:\u061F!\u2026]/.test(first.v), atom.id);
  }
});
