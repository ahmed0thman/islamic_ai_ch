import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { rulingLocus, splitRulings } from "./rulings.ts";
import type { Surah } from "./types";

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
