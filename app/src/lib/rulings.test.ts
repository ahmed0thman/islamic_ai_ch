import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { rulingLocus, splitRulings, sortByCertainty, kindsByCertainty, badgesByCertainty } from "./rulings.ts";
import type { BadgeKey, IconKey, Surah } from "./types";

const surah: Surah = JSON.parse(await readFile(new URL("../../../content/export/surah-93.json", import.meta.url), "utf8"));
const all = Object.values(surah.records).flatMap((record) => record.evidence.flatMap((evidence) => evidence.rulings));

test("93: every ruling's locus is one of the four the schema names", () => {
  assert.ok(all.length > 0);
  for (const ruling of all) assert.ok(["matn", "footnote", "book_condition", "platform_grade"].includes(rulingLocus(ruling)), ruling.where);
});

test("93: a book condition (a reporting, a book title) is takhrij and never a ruling; the others stay rulings", () => {
  const { rulings, takhrij } = splitRulings(all);
  assert.equal(rulings.length + takhrij.length, all.length);
  assert.ok(takhrij.length > 0 && rulings.length > 0);
  assert.ok(takhrij.every((ruling) => rulingLocus(ruling) === "book_condition"));
  assert.ok(rulings.every((ruling) => rulingLocus(ruling) !== "book_condition"));
});

test("93-r056: 'tracking down' lines and the book's name leave the ruling list; the platform grade stays", () => {
  const evidence = surah.records["93-r056"].evidence;
  const { rulings, takhrij } = splitRulings(evidence.flatMap((item) => item.rulings));
  assert.ok(rulings.some((ruling) => rulingLocus(ruling) === "platform_grade"));
  assert.ok(takhrij.some((ruling) => ruling.text.startsWith("أخرجه البخاري برقم")));
  assert.ok(takhrij.some((ruling) => ruling.text === "صحيح أسباب النزول"));
});

const order: IconKey[] = ["ayah", "hadith", "athar", "scholar", "link", "hidaya"];
const rec = (id: string, badge: BadgeKey | null, icons: IconKey[]) => ({ id, badge, icons });
test("records open firmest first: thabit, no badge, khilaf_mutabar, la_yathbut; equal rank by the legend's kind order; stable", () => {
  const input = [rec("a", "la_yathbut", ["ayah"]), rec("b", "khilaf_mutabar", ["ayah"]), rec("c", null, ["link"]), rec("d", "thabit", ["scholar"]), rec("e", null, ["hadith"]), rec("f", null, ["hadith"]), rec("g", "thabit", ["ayah"])];
  const snapshot = structuredClone(input);
  assert.deepEqual(sortByCertainty(input, order).map((record) => record.id), ["g", "d", "e", "f", "c", "b", "a"]);
  assert.deepEqual(input, snapshot, "the input is not reordered in place");
  // Stable: records equal in rank and kind keep the order they came in, whichever way they came.
  assert.deepEqual(sortByCertainty([input[5], input[4]], order).map((record) => record.id), ["f", "e"]);
  assert.deepEqual(sortByCertainty([], order), []);
  // The kind order decides among equals by the record's earliest kind; a later kind never counts.
  assert.deepEqual(sortByCertainty([rec("x", null, ["link", "hadith"]), rec("y", null, ["athar", "link"]), rec("z", null, ["hadith"])], order).map((record) => record.id), ["x", "z", "y"]);
});
test("the kinds and badges of a marker follow the firmest record", () => {
  const records = [rec("a", "la_yathbut", ["link"]), rec("b", "thabit", ["hadith", "ayah"]), rec("c", "khilaf_mutabar", ["scholar"]), rec("d", null, ["athar"])];
  assert.deepEqual(kindsByCertainty(records, order), ["ayah", "hadith", "athar", "scholar", "link"]);
  assert.deepEqual(kindsByCertainty([records[0], records[2]], order), ["scholar", "link"]);
  assert.deepEqual(badgesByCertainty(records.map((record) => record.badge)), ["khilaf_mutabar", "la_yathbut"]);
  assert.deepEqual(badgesByCertainty(["la_yathbut", "thabit", null, "la_yathbut"]), ["la_yathbut"]);
  assert.deepEqual(badgesByCertainty([]), []);
});
test("93: sorting every record group the content cites never loses or duplicates a record", () => {
  const ranks = { thabit: 0, none: 1, khilaf_mutabar: 2, la_yathbut: 3 };
  const records = Object.values(surah.records);
  const sorted = sortByCertainty(records, order);
  assert.deepEqual(new Set(sorted.map((record) => record.id)), new Set(records.map((record) => record.id)));
  assert.equal(sorted.length, records.length);
  for (let i = 1; i < sorted.length; i++) assert.ok(ranks[sorted[i - 1].badge ?? "none"] <= ranks[sorted[i].badge ?? "none"]);
});
