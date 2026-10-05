import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { sourceAtoms, MAX_PASSAGES, MAX_UNITS, MAX_UNITS_PER_PASSAGE } from "./source-atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { CHAIN_MARKERS, REPORT_MARKERS, REPORT_SOURCES, guardTokens, hasMarker } from "./source-guard.ts";
import type { Surah } from "../types";
import type { RetrievedPassage } from "../rag/retrieve";

// Arabic comes only from the exported evidence quotes; markers come from the guard file itself.
const surah: Surah = JSON.parse(await readFile(new URL("../../../../content/export/surah-108.json", import.meta.url), "utf8"));
const COMMA = String.fromCodePoint(0x60c);
const single = new RegExp("^[^.!" + String.fromCodePoint(0x61f, 0x61b) + String.fromCharCode(10) + "]+" + String.fromCharCode(92) + ".$", "u");
const clean = [...new Set(Object.values(surah.records).flatMap((record) => record.evidence.map((evidence) => evidence.quote.trim())))]
  .filter((quote) => single.test(quote) && quote.split(/\s+/u).length >= 4 && quote.split(/\s+/u).length <= 40
    && !hasMarker(guardTokens(quote), REPORT_MARKERS) && !hasMarker(guardTokens(quote), CHAIN_MARKERS));
const passage = (text: string, id = "1", source_id = "tafsir_test"): RetrievedPassage => ({
  id, source_id, source_title: "title", author: "author", locator: "1/2", url: null, text, ayah_keys: ["108:1"], score: 1,
});
const words = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(" ");

test("fixtures are usable", () => { assert.ok(clean.length >= 4); assert.ok(REPORT_MARKERS.length > 0 && CHAIN_MARKERS.length > 0 && REPORT_SOURCES.size > 0); });

test("a passage of a narration collection is dropped whole", () => {
  const out = sourceAtoms([passage(clean.slice(0, 3).join(" "), "1", [...REPORT_SOURCES][0])], "q", 1);
  assert.equal(out.atoms.length, 0);
  assert.equal(out.dropped.report_source, 1);
});

test("a passage with a transmission chain marker yields nothing", () => {
  const text = `${clean[0]} ${CHAIN_MARKERS[0].join(" ")} ${clean[1]} ${clean[2]}`;
  const out = sourceAtoms([passage(text)], "q", 1);
  assert.equal(out.atoms.length, 0);
  assert.equal(out.dropped.chain, 1);
});

test("a unit with a report marker and the unit after it are dropped; an unrelated later unit survives", () => {
  const marker = REPORT_MARKERS[0].join(" ");
  const text = `${clean[0]} ${marker} ${clean[1]} ${clean[2]} ${clean[3]}`;
  const out = sourceAtoms([passage(text)], "q", 1);
  const texts = out.atoms.map((atom: { text: string }) => atom.text);
  assert.equal(out.dropped.report_unit, 2);
  assert.ok(texts.includes(clean[0]));
  assert.ok(!texts.some((item: string) => item.includes(clean[2])));
  assert.ok(texts.includes(clean[3]));
});

test("a unit longer than 45 words is split at the comma nearest its middle; one that stays over 60 words is discarded", () => {
  const long = `${words("alpha", 30)}${COMMA} ${words("beta", 30)}.`;
  const out = sourceAtoms([passage(long)], "q", 1);
  assert.equal(out.atoms.length, 2);
  assert.ok(out.atoms[0].text.endsWith(COMMA));
  assert.ok(out.atoms.every((atom: { text: string }) => atom.text.split(/\s+/u).length <= 45));
  assert.equal(sourceAtoms([passage(`${words("gamma", 70)}.`)], "q", 1).atoms.length, 0);
  assert.equal(sourceAtoms([passage(`${words("delta", 50)}.`)], "q", 1).atoms.length, 1);
});

test("units under four words are dropped and counted", () => {
  const out = sourceAtoms([passage(`one two three. ${words("kept", 5)}.`)], "q", 1);
  assert.equal(out.atoms.length, 1);
  assert.equal(out.dropped.short, 1);
});

test("caps: six passages, ten units per passage, forty-eight in all; question words pick the units; original order kept", () => {
  const many = (id: string) => passage(Array.from({ length: 12 }, (_, i) => `${i === 11 ? "zebra " : ""}${words(`w${id}x${i}`, 4)}.`).join(" "), id);
  const out = sourceAtoms(Array.from({ length: 10 }, (_, i) => many(String(i + 1))), "zebra", 2);
  const perPassage = new Map<string, number>();
  for (const atom of out.atoms) perPassage.set(atom.id.split(":")[1], (perPassage.get(atom.id.split(":")[1]) ?? 0) + 1);
  assert.ok(perPassage.size <= MAX_PASSAGES);
  assert.ok([...perPassage.values()].every((count) => count <= MAX_UNITS_PER_PASSAGE));
  assert.ok(out.atoms.length <= MAX_UNITS && out.atoms.length === 48);
  const first = out.atoms.filter((atom: { id: string }) => atom.id.startsWith("src:1:"));
  assert.ok(first.some((atom: { id: string }) => atom.id === "src:1:11"), "the unit holding the question word is kept");
  const indexes = first.map((atom: { id: string }) => Number(atom.id.split(":")[2]));
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test("a source atom is a verbatim substring of its passage with the plain shape", () => {
  const text = clean.slice(0, 3).join(" ");
  const out = sourceAtoms([passage(text, "77")], "q", 3, 108);
  assert.ok(out.atoms.length >= 1);
  for (const atom of out.atoms) {
    assert.ok(text.includes(atom.text));
    assert.ok(/^src:77:\d+$/.test(atom.id));
    assert.equal(atom.role, "source");
    assert.equal(atom.level, 3);
    assert.deepEqual(atom.records, []);
    assert.deepEqual(atom.segments, [{ t: "text", v: atom.text }]);
    assert.deepEqual(atom.source, { source_id: "tafsir_test", title: "title", author: "author", locator: "1/2", url: null });
    assert.equal(atom.surah, 108);
  }
});
