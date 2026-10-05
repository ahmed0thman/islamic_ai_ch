import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { composedView } from "./ask-composed-view.ts";
import type { AskResponse, PublicAtom } from "./ask/types";

const atom = (id: string, records: string[], level: PublicAtom["level"] = 1): PublicAtom => ({
  id, level, role: "claim", segments: [{ t: "text", v: id }], records,
});

test("null unless an answer composed from non-empty sentences", () => {
  const atoms = [atom("a", ["r1"])];
  assert.equal(composedView({ status: "answer", atoms }), null);
  assert.equal(composedView({ status: "answer", mode: "extractive", atoms }), null);
  assert.equal(composedView({ status: "answer", mode: "composed", atoms }), null);
  assert.equal(composedView({ status: "answer", mode: "composed", composed: [], atoms }), null);
  assert.equal(composedView({ status: "insufficient", mode: "composed", composed: [{ text: "t", atom_ids: ["a"] }], atoms }), null);
});

test("null when no written item survives", () => {
  assert.equal(composedView({ status: "answer", mode: "composed", composed: [{ text: "t", atom_ids: ["gone"] }], atoms: [atom("a", ["r1"])] }), null);
  assert.equal(composedView({ status: "answer", mode: "composed", composed: [{ atom_ids: ["a"] }], atoms: [atom("a", ["r1"])] }), null);
});

test("a written sentence followed by a verbatim sentence, in order", () => {
  const atoms = [atom("a", ["r1"]), atom("b", ["r2"], 2)];
  const view = composedView({ status: "answer", mode: "composed", composed: [{ text: "T", atom_ids: ["b"] }, { atom_ids: ["a", "b"] }], atoms })!;
  assert.deepEqual(view, [
    { kind: "written", text: "T", atoms: [atoms[1]], records: ["r2"] },
    { kind: "verbatim", atoms: [atoms[0], atoms[1]] },
  ]);
});

test("unknown ids are skipped; a written sentence keeps its remaining atoms", () => {
  const atoms = [atom("a", ["r1"])];
  const view = composedView({ status: "answer", mode: "composed", composed: [{ text: "T", atom_ids: ["gone", "a"] }], atoms })!;
  assert.deepEqual(view, [{ kind: "written", text: "T", atoms, records: ["r1"] }]);
});

test("records are the atoms' union, each once, in first-seen order", () => {
  const atoms = [atom("a", ["r2", "r1"]), atom("b", ["r1", "r3"]), atom("c", ["r2"])];
  const view = composedView({ status: "answer", mode: "composed", composed: [{ text: "T", atom_ids: ["a", "b", "c"] }], atoms })!;
  assert.equal(view[0]!.kind, "written");
  assert.deepEqual(view[0]!.records, ["r2", "r1", "r3"]);
});
