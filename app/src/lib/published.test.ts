import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { onlyPublished, publishedSurahs } from "./published.ts";

const expected = [93, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
const all = [78, 96, ...expected].map((no) => ({ no, name: `s${no}` }));

test("the published list is Duha, then the delivery scope 100 to 114 in mushaf order, without repeats", () => {
  assert.deepEqual([...publishedSurahs], expected);
  assert.equal(new Set(publishedSurahs).size, publishedSurahs.length);
});
test("only the published surahs come back, in the order of the list and not of the index", () => {
  assert.deepEqual(onlyPublished([...all].reverse()).map((item: { no: number }) => item.no), expected);
  assert.deepEqual(onlyPublished(all, [112, 93]).map((item: { no: number }) => item.no), [112, 93]);
});
test("a published surah missing from the index is an error, not a silent gap", () => {
  assert.throws(() => onlyPublished(all.filter((item) => item.no !== 107)), /107/);
});
