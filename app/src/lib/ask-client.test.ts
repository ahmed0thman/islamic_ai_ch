import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { blockRole, displaySegments, drawingFor, sourceRecordOf } from "./ask-client.ts";
// @ts-expect-error -- Node requires source extensions.
import { composedView } from "./ask-composed-view.ts";
// @ts-expect-error -- Node requires source extensions.
import { addAsked, parseAsked, resolveAsked, serializeAsked } from "./asked.ts";
import type { PublicAtom } from "./ask/types";

const source: PublicAtom = { id: "src:5:2", level: 1, role: "source", records: [], surah: 108, segments: [{ t: "text", v: "x y z w" }],
  source: { source_id: "s", title: "title", author: "author", locator: "1/2", url: null } };
const verified: PublicAtom = { id: "108:1:blocks.0:0", level: 1, role: "claim", records: ["108-r01"], surah: 108, segments: [{ t: "text", v: "verified" }] };

test("a book excerpt gets a stand-in record in the source_direct state and a marker that opens it", () => {
  const record = sourceRecordOf(source)!;
  assert.equal(record.id, source.id);
  assert.equal(record.state, "source_direct");
  assert.equal(record.evidence[0].quote, "x y z w");
  assert.equal(record.evidence[0].source_title, "title");
  assert.equal(sourceRecordOf(verified), undefined);
  assert.deepEqual(displaySegments(source).at(-1), { t: "mark", records: [source.id] });
  assert.equal(displaySegments(verified), verified.segments);
  assert.equal(blockRole(source), "claim");
});

test("the drawing merges the open surah's records, the server's extras and the stand-in records", () => {
  const reading = { records: { "108-r01": { id: "108-r01" } as never }, ayahs: new Map([["108:1", { key: "108:1", no: 1, text: "a" }]]) };
  const extra = { records: { "93-r01": { id: "93-r01" } as never }, ayahs: [{ key: "93:1", no: 1, text: "b" }] };
  const drawing = drawingFor(reading, [source, verified], extra);
  assert.deepEqual(Object.keys(drawing.records).sort(), ["108-r01", "93-r01", source.id].sort());
  assert.deepEqual([...drawing.ayahs.keys()].sort(), ["108:1", "93:1"]);
});

test("a written sentence that cites a book excerpt carries the excerpt's own id as its record", () => {
  const view = composedView({ status: "answer", mode: "composed", composed: [{ text: "T", atom_ids: [verified.id, source.id] }], atoms: [verified, source] })!;
  assert.deepEqual((view[0] as { records: string[] }).records, ["108-r01", source.id]);
});

test("a saved answer keeps its book excerpts and still resolves after a reload; a malformed held list is ignored", () => {
  const entry = { question: "q", atomIds: [verified.id, source.id], depth: 1 as const, stop: null, at: 5, held: [source] };
  const stored = parseAsked(serializeAsked(addAsked([], entry)));
  const content = new Map([[verified.id, verified]]);
  const resolved = resolveAsked(stored, content);
  assert.equal(resolved.length, 1);
  assert.deepEqual(resolved[0].atoms.map((atom: PublicAtom) => atom.id), [verified.id, source.id]);
  // Without what was held the entry drops silently, as any entry whose sentence is gone.
  assert.equal(resolveAsked(parseAsked(serializeAsked(addAsked([], { ...entry, held: undefined }))), content).length, 0);
  assert.equal(resolveAsked(parseAsked(serializeAsked(addAsked([], { ...entry, held: [{ id: 1 }] as never }))), content).length, 0);
});
