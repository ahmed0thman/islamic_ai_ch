import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { publicAtom, surahOf } from "./public-atom.ts";
// @ts-expect-error -- Node requires source extensions.
import { deriveAtoms } from "./atoms.ts";
import type { Surah } from "../types";
import type { Atom } from "./types";

const surah112: Surah = JSON.parse(await readFile(new URL("../../../../content/export/surah-112.json", import.meta.url), "utf8"));

test("the surah of a sentence is its field when it has one, else the number its id starts with, else none", () => {
  assert.equal(surahOf({ id: "108:1:blocks.2:0" }), 108);
  assert.equal(surahOf({ id: "112:term:112-r41" }), 112, "a term definition");
  assert.equal(surahOf({ id: "93:0:blocks.1.title:0" }), 93);
  assert.equal(surahOf({ id: "9:1:blocks.0:0" }), 9);
  assert.equal(surahOf({ id: "108:1:blocks.2:0", surah: 112 }), 112, "the field wins over the id");
  assert.equal(surahOf({ id: "src:12:3", surah: 108 }), 108, "a book excerpt carries the surah it was woven for");
  assert.equal(surahOf({ id: "src:12:3" }), undefined);
  assert.equal(surahOf({ id: "1234:1:blocks.0:0" }), undefined, "no surah has four digits");
  assert.equal(surahOf({ id: "x:1" }), undefined);
  assert.equal(surahOf({ id: "" }), undefined);
  assert.equal(surahOf({ id: "108" }), undefined, "the number must be followed by a colon");
});

test("what leaves the server about a sentence is its id, level, role, segments and records, and its surah and source when it has them: never its search text or its places", () => {
  const verified: Atom = { id: "108:1:blocks.2:0", level: 1, role: "claim", text: "search text", records: ["108-r01"], segments: [{ t: "text", v: "words" }, { t: "mark", records: ["108-r01"] }], locations: [{ depth: 1, stops: [2] }] };
  const out = publicAtom(verified);
  assert.deepEqual(out, { id: "108:1:blocks.2:0", level: 1, role: "claim", segments: verified.segments, records: ["108-r01"], surah: 108 });
  assert.ok(!Object.hasOwn(out, "text") && !Object.hasOwn(out, "locations") && !Object.hasOwn(out, "source"));
  const excerpt: Atom = { id: "src:7:2", level: 2, role: "source", text: "excerpt", records: [], segments: [{ t: "text", v: "excerpt" }],
    source: { source_id: "tafsir_x", title: "title", author: "author", locator: "1/2", url: null }, surah: 112 };
  assert.deepEqual(publicAtom(excerpt), { id: "src:7:2", level: 2, role: "source", segments: excerpt.segments, records: [], surah: 112, source: excerpt.source });
  const noSurah: Atom = { id: "src:7:3", level: 2, role: "source", text: "x", records: [], segments: [] };
  assert.ok(!Object.hasOwn(publicAtom(noSurah), "surah"), "a surah that is not known is left out, not sent as undefined");
  assert.ok(!Object.hasOwn(publicAtom(noSurah), "source"));
});
test("every sentence of a published surah goes out with its surah and without its search text", () => {
  const atoms = deriveAtoms(surah112) as Atom[];
  assert.ok(atoms.length > 50);
  for (const atom of atoms) {
    const copy = structuredClone(atom);
    const out = publicAtom(atom);
    assert.deepEqual(atom, copy, "the atom was changed");
    assert.deepEqual(Object.keys(out).sort(), ["id", "level", "records", "role", "segments", "surah"]);
    assert.equal(out.surah, 112, atom.id);
    assert.deepEqual(out.records, atom.records);
  }
});
