import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node tests require explicit source extensions.
import { createWeaveClient, weaveKey, weaveQuestions } from "./weave-client.ts";
import type { AskedQuestion } from "./asked";
import type { AskResponse } from "./ask/types";

const saved = (id: string, depth: AskedQuestion["depth"], stop: number | null, question = id): AskedQuestion => ({ id, depth, stop, question, atomIds: ["a"], at: 1 });
const input = { surah: 108, depth: 1 as const, stop: 1, questions: ["reader question"] };
const composed: AskResponse = { status: "answer", mode: "composed", atoms: [{ id: "a", records: ["r"], role: "claim", level: 1, segments: [] }],
  composed: [{ text: "first sentence", atom_ids: ["a"] }, { text: "second sentence", atom_ids: ["a"] }] };

test("questions of the exact stop and depth precede other surah questions, with a five-question cap", () => {
  const list = [saved("other-depth", 2, 1), saved("other-stop", 1, 2), saved("local-new", 1, 1), saved("local-old", 1, 1), saved("closing", 1, null), saved("last", 0, null)];
  assert.deepEqual(weaveQuestions(list, 1, 1), ["local-new", "local-old", "other-depth", "other-stop", "closing"]);
  assert.deepEqual(weaveQuestions([], 1, 1), []);
});
test("question selection trims, drops blanks, removes duplicates and bounds each question", () => {
  const list = [saved("a", 1, 1, "  same  "), saved("b", 1, 2, "same"), saved("c", 1, 1, " "), saved("d", 0, null, "x".repeat(301))];
  assert.deepEqual(weaveQuestions(list, 1, 1), ["same", "x".repeat(300)]);
});
test("a composed result is cached by surah, depth and stop and reused only on request", async () => {
  const sent: { url: string; body: unknown }[] = [];
  const client = createWeaveClient(async (url, options) => {
    assert.equal(options?.method, "POST");
    sent.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return Response.json(composed);
  });
  assert.equal(sent.length, 0);
  assert.deepEqual(await client(input), composed);
  assert.deepEqual(await client({ ...input, questions: ["new question"] }), composed);
  assert.deepEqual(sent, [{ url: "/api/weave/", body: input }]);
  await client({ ...input, depth: 2 }); await client({ ...input, stop: 2 }); await client({ ...input, surah: 93 });
  assert.equal(sent.length, 4);
  assert.equal(weaveKey(input), "108:1:1");
  const separate = createWeaveClient(async () => { sent.push({ url: "separate", body: input }); return Response.json(composed); });
  await separate(input);
  assert.equal(sent.length, 5, "another session has no cache");
});
test("HTTP failures, unavailable, malformed and fewer than two surviving sentences are never cached", async () => {
  const invalid = [Response.json({ status: "unavailable" }), Response.json({}, { status: 429 }), Response.json({ ...composed, mode: "extractive" }),
    Response.json({ ...composed, composed: composed.composed!.slice(0, 1) }), Response.json({ ...composed, composed: [composed.composed![0], { atom_ids: ["a"] }] }),
    Response.json({ ...composed, composed: [composed.composed![0], { kind: "example", text: "example" }] }), new Response("invalid json"), Response.json(null)];
  for (const response of invalid) {
    let calls = 0;
    const client = createWeaveClient(async () => { calls++; return calls === 1 ? response : Response.json(composed); });
    assert.equal(await client(input), null);
    assert.deepEqual(await client(input), composed);
    assert.equal(calls, 2);
  }
});
test("connection errors and cancelled requests leave no cache; empty questions send nothing", async () => {
  let calls = 0;
  const client = createWeaveClient(async () => { calls++; throw new Error("network"); });
  assert.equal(await client({ ...input, questions: [] }), null);
  assert.equal(calls, 0);
  assert.equal(await client(input), null);
  assert.equal(await client(input), null);
  const controller = new AbortController(); controller.abort();
  assert.equal(await client(input, controller.signal), null);
  assert.equal(calls, 2);
  const late = new AbortController();
  const aborted = createWeaveClient(async () => { late.abort(); return Response.json(composed); });
  assert.equal(await aborted(input, late.signal), null);
});
