import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node tests require explicit source extensions.
import { parseWeaveRequest, stopAtoms, weaveResult, weaveStop } from "./weave.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { deriveAtoms, readerUnits } from "./atoms.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { answer } from "./answer.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { requestAllowed, responseFor } from "./runtime.ts";
import type { ParagraphBlock, Surah } from "../types";
import type { AskResponse, ChoiceProvider, SelectionRequest } from "./types";

const original: Surah = JSON.parse(await readFile(new URL("../../../../content/export/surah-108.json", import.meta.url), "utf8"));
const ui = JSON.parse(await readFile(new URL("../../../../content/ui.ar.json", import.meta.url), "utf8"));
const source = structuredClone(original);
const record = Object.keys(source.records)[0];
const paragraph = (text: string, title?: string): ParagraphBlock => ({ type: "paragraph", role: "claim", segments: [{ t: "text", v: text }, { t: "mark", records: [record] }],
  ...(title ? { title, ayahs: ["108:1"], passage: source.passages?.[0].id } : {}) });
source.levels = [
  { depth: 0, blocks: [paragraph("shared careful reader", "Earlier stop")] },
  { depth: 1, blocks: [paragraph("shared careful reader", "First stop"), paragraph("clear patient reading"), paragraph("another sentence with the same record", "Second stop"), { ...paragraph("summary outside the stop"), kind: "summary" }] },
  { depth: 2, blocks: [paragraph("another depth with the same record", "Deeper stop")] },
];
const input = { surah: 108, depth: 1 as const, stop: 1, questions: ["careful reader", "patient reading"] };
const quiet = { log: () => {} };
const composition = { status: "answer", sentences: stopAtoms(source, 1, 1).map((atom) => ({ text: atom.text, cites: [atom.id] })) };
const allSupported: ChoiceProvider = { async choose(request) {
  return request.stage === "support" ? { verdicts: JSON.parse(request.message).items.map((_: unknown, index: number) => ({ index, supported: true })) } : composition;
} };

test("only atoms inside the requested stop survive, even when other stops and depths share their records", () => {
  const selected = stopAtoms(source, 1, 1);
  assert.deepEqual(selected.map((atom) => atom.text), ["shared careful reader", "clear patient reading"]);
  assert.equal(selected[0].level, 0, "a deduplicated lower-depth id remains in this stop");
  assert.ok(deriveAtoms(source).length > selected.length);
  assert.deepEqual(stopAtoms(source, 1, 2).map((atom) => atom.text), ["another sentence with the same record"]);
  assert.deepEqual(stopAtoms(source, 1, 99), []);
});
test("real exported stops and depth-item sections select their sentences and only their records", () => {
  let sections = 0;
  for (const depth of [0, 1, 2, 3] as const) for (const unit of readerUnits(original, depth)) {
    const selected = stopAtoms(original, depth, unit.number);
    const records = new Set(unit.recordIds);
    assert.ok(selected.length, `${depth}:${unit.number}`);
    assert.ok(selected.every((atom) => atom.role !== "source" && atom.records.every((id) => records.has(id))));
    if ("kind" in unit && unit.kind) sections++;
  }
  assert.ok(sections > 0, "includes units derived from depth items");
});
test("request validation trims and drops empty questions, bounds all fields and accepts exactly five", () => {
  assert.deepEqual(parseWeaveRequest({ ...input, questions: ["  careful reader  ", "  "] }), { ...input, questions: ["careful reader"] });
  assert.equal(parseWeaveRequest({ ...input, questions: Array(5).fill("x".repeat(300)) })?.questions.length, 5);
  for (const invalid of [null, [], {}, { ...input, surah: "108" }, { ...input, surah: 108.1 }, { ...input, depth: 4 }, { ...input, depth: "1" },
    { ...input, stop: 0 }, { ...input, stop: 1.1 }, { ...input, questions: "question" }, { ...input, questions: [1] }, { ...input, questions: [" "] },
    { ...input, questions: Array(6).fill("question") }, { ...input, questions: ["x".repeat(301)] }]) assert.equal(parseWeaveRequest(invalid), undefined);
});
test("weaving uses the fixed dictionary instruction, reader questions only, and the exact stop context", async () => {
  const calls: SelectionRequest[] = [];
  const result = await weaveStop(source, input, ui.weave.instruction, [{ async choose(request) { calls.push(request); return allSupported.choose(request); } }], quiet);
  assert.equal(result.status, "answer"); assert.equal(result.mode, "composed"); assert.equal(result.composed?.length, 2);
  const prompt = calls.find((request) => request.stage === "compose")!.message;
  const block = (key: string) => JSON.parse(prompt.split(`BEGIN_${key}_JSON\n`)[1].split(`\nEND_${key}_JSON`)[0]);
  assert.equal(block("QUESTION").question, ui.weave.instruction);
  assert.deepEqual(block("HISTORY").turns, input.questions.map((question) => ({ question, answer: "", shown_sentence_ids: [] })));
  assert.equal(block("READER_CONTEXT").depth, 1); assert.equal(block("READER_CONTEXT").stop_title, "First stop");
  assert.deepEqual(block("SENTENCES").map((item: { sentence: string }) => item.sentence), ["shared careful reader", "clear patient reading"]);
  assert.ok(calls.some((request) => request.stage === "support"));
  assert.ok(!calls.some((request) => request.stage === "select"));
});
test("fewer than two supported sentences returns unavailable, and never counts a verbatim fallback", async () => {
  const provider: ChoiceProvider = { async choose(request) {
    return request.stage === "support" ? { verdicts: JSON.parse(request.message).items.map((_: unknown, index: number) => ({ index, supported: index === 0 })) } : composition;
  } };
  assert.deepEqual(await weaveStop(source, input, ui.weave.instruction, [provider], quiet), { status: "unavailable", atoms: [] });
  const atoms = stopAtoms(source, 1, 1);
  const partial: AskResponse = { status: "answer", mode: "composed", atoms, composed: [{ text: atoms[0].text, atom_ids: [atoms[0].id] }, { atom_ids: [atoms[1].id] }, { kind: "example", text: "example" }] };
  assert.deepEqual(weaveResult(partial), { status: "unavailable", atoms: [] });
  assert.deepEqual(weaveResult({ status: "answer", mode: "extractive", atoms }), { status: "unavailable", atoms: [] });
});
test("two surviving sentences keep their order and sources; dropped sentences and examples stay out", () => {
  const atoms = deriveAtoms(source);
  const result = weaveResult({ status: "answer", mode: "composed", atoms, composed: [{ text: atoms[1].text, atom_ids: [atoms[1].id] }, { atom_ids: [atoms[2].id] }, { kind: "example", text: "example" }, { text: atoms[0].text, atom_ids: [atoms[0].id] }] });
  assert.deepEqual(result.composed?.map((item) => item.text), [atoms[1].text, atoms[0].text]);
  assert.deepEqual(result.atoms.map((atom) => atom.id), [atoms[0].id, atoms[1].id]);
});
test("unknown stops, missing instruction, provider errors and fixed refusals are unavailable", async () => {
  assert.deepEqual(await weaveStop(source, { ...input, stop: 99 }, ui.weave.instruction, [], quiet), { status: "unavailable", atoms: [] });
  assert.deepEqual(await weaveStop(source, input, "", [], quiet), { status: "unavailable", atoms: [] });
  for (const provider of [{ async choose() { throw new Error("provider failed"); } }, { async choose() { return { status: "insufficient", sentences: [] }; } }]) {
    assert.deepEqual(await weaveStop(source, input, ui.weave.instruction, [provider], quiet), { status: "unavailable", atoms: [] });
  }
});
test("disabling extractive fallback avoids both cited-verbatim and selection while the default stays unchanged", async () => {
  const atoms = stopAtoms(source, 1, 1);
  for (const fail of [false, true]) {
    const calls: string[] = [];
    const provider: ChoiceProvider = { async choose(request) {
      calls.push(request.stage!);
      if (fail && request.stage !== "select") throw new Error("failed");
      if (request.stage === "select") return { status: "answer", atom_ids: [atoms[0].id] };
      if (request.stage === "support") return { verdicts: JSON.parse(request.message).items.map((_: unknown, index: number) => ({ index, supported: false })) };
      return composition;
    } };
    assert.equal((await answer("q", atoms, undefined, provider, quiet)).mode, "extractive");
    calls.length = 0;
    // A writer that failed is unavailable; a writer whose sentences did not stand is insufficient.
    assert.deepEqual(await answer("q", atoms, undefined, provider, { ...quiet, extractiveFallback: false }), { status: fail ? "unavailable" : "insufficient", atoms: [] });
    assert.ok(!calls.includes("select"));
  }
});
test("shared ask rate handling allows ten requests per IP and fixed responses are not cacheable", async () => {
  const request = new Request("http://local/api/weave", { headers: { "x-forwarded-for": "weave-test-ip, proxy" } });
  for (let i = 0; i < 10; i++) assert.equal(requestAllowed(request), true);
  assert.equal(requestAllowed(request), false);
  const response = responseFor("unavailable");
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { status: "unavailable", atoms: [] });
});
