import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveTermsSummary } from "./terms-summary.ts";
import type { Block, Segment, SourceRecord } from "./types";

const record = (id: string, science?: string | null): SourceRecord => ({ id, icons: ["scholar"], badge: null, claim: id, status_text: "", depth_min: 0, ayah_keys: [], evidence: [], ...(science === undefined ? {} : { science }) });
const records: Record<string, SourceRecord> = Object.fromEntries([record("a", "balagha"), record("b", "lugha"), record("c"), record("d", "balagha"), record("e", "unknown_key"), record("f", null)].map((item) => [item.id, item]));
const sciences = { balagha: "B", lugha: "L" };
const term = (v: string, id: string): Segment => ({ t: "term", v, record: id });
const para = (...segments: Segment[]): Block => ({ type: "paragraph", role: "claim", segments });
const mark: Segment = { t: "mark", records: ["a"] };

test("a level without terms has no summary", () => {
  assert.equal(deriveTermsSummary([para({ t: "text", v: "x" }, mark)], records, sciences), null);
  assert.equal(deriveTermsSummary([], records, sciences), null);
});
test("terms group under their science in the order the sciences are met; no-science terms come last", () => {
  const blocks = [para(term("t-c", "c"), mark), para(term("t-b", "b"), term("t-a", "a"), mark), para(term("t-d", "d"), mark)];
  const summary = deriveTermsSummary(blocks, records, sciences)!;
  assert.equal(summary.termCount, 4);
  assert.equal(summary.scienceCount, 2);
  assert.deepEqual(summary.groups.map((group: { science: string | null }) => group.science), ["lugha", "balagha", null]);
  assert.deepEqual(summary.groups[1].terms.map((item: { text: string }) => item.text), ["t-a", "t-d"]);
});
test("a record counts once, under the text it was first met with", () => {
  const summary = deriveTermsSummary([para(term("first", "a"), mark), para(term("second", "a"), mark)], records, sciences)!;
  assert.equal(summary.termCount, 1);
  assert.equal(summary.groups[0].terms[0].text, "first");
});
test("an unknown science key, a null science and a missing dictionary all fall back to no science", () => {
  const blocks = [para(term("e", "e"), mark), para(term("f", "f"), mark)];
  const summary = deriveTermsSummary(blocks, records, sciences)!;
  assert.deepEqual(summary.groups.map((group: { science: string | null }) => group.science), [null]);
  assert.equal(summary.scienceCount, 0);
  assert.equal(deriveTermsSummary([para(term("a", "a"), mark)], records, undefined)!.scienceCount, 0);
});
test("terms inside a details title and its inner paragraphs are found", () => {
  const blocks: Block[] = [{ type: "details", title: [{ t: "term", v: "in-title", record: "a" }, { t: "mark", records: ["a"] }], blocks: [{ type: "paragraph", role: "claim", segments: [term("inner", "b"), mark] }] }];
  assert.equal(deriveTermsSummary(blocks, records, sciences)!.termCount, 2);
});
test("a term whose record is missing is skipped, and the blocks are not changed", () => {
  const blocks = [para(term("ghost", "zzz"), term("ok", "a"), mark)];
  const snapshot = structuredClone(blocks);
  assert.equal(deriveTermsSummary(blocks, records, sciences)!.termCount, 1);
  assert.deepEqual(blocks, snapshot);
});
