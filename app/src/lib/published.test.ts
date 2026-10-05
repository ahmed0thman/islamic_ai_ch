import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { onlyPublished, publishedSurahs } from "./published.ts";

const all = [78, 93, 96, 107, 108, 112].map((no) => ({ no, name: `s${no}` }));

test("the published list is Duha, Kawthar, Ma'un, Ikhlas in this order, without repeats", () => {
  assert.deepEqual([...publishedSurahs], [93, 108, 107, 112]);
  assert.equal(new Set(publishedSurahs).size, publishedSurahs.length);
});
test("only the published surahs come back, in the order of the list and not of the index", () => {
  assert.deepEqual(onlyPublished(all).map((item: { no: number }) => item.no), [93, 108, 107, 112]);
  assert.deepEqual(onlyPublished(all, [112, 93]).map((item: { no: number }) => item.no), [112, 93]);
});
test("a published surah missing from the index is an error, not a silent gap", () => {
  assert.throws(() => onlyPublished(all.filter((item) => item.no !== 107)), /107/);
});
