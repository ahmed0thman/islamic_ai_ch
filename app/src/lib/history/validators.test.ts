import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { progressInput, questionInput } from "./validators.ts";
// @ts-expect-error -- Node requires source extensions.
import { HISTORY_LIMITS } from "./types.ts";

const throwsValidation = (run: () => unknown): void => assert.throws(run, (error: { code?: string }) => error.code === "validation");
const atoms = (count: number): string[] => Array.from({ length: count }, (_, index) => `2:255:blocks.0:${index}`);
const visited = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

test("progress accepts a well-formed place and nulls the stop", () => {
  assert.deepEqual(progressInput({ surah: 114, depth: 3, stop: null, visited: [4, 2, 4] }), { surah: 114, depth: 3, stop: null, visited: [4, 2, 4] });
});

test("progress bounds: surah 1..114, depth 0..3, stop non-negative, visited at most 300", () => {
  const ok = { surah: 1, depth: 0, stop: 0, visited: [] };
  for (const over of [
    { ...ok, surah: 0 }, { ...ok, surah: 115 }, { ...ok, depth: -1 }, { ...ok, depth: 4 },
    { ...ok, stop: -1 }, { ...ok, visited: visited(HISTORY_LIMITS.visited + 1) },
  ]) throwsValidation(() => progressInput(over));
  assert.equal(progressInput({ ...ok, visited: visited(HISTORY_LIMITS.visited) }).visited.length, HISTORY_LIMITS.visited);
});

test("question trims the text and keeps 1..500 characters", () => {
  const base = { surah: 2, depth: 1, stop: 3, question: "  ما معنى؟  ", atomIds: ["a"], askedAt: undefined };
  assert.equal(questionInput(base).question, "ما معنى؟");
  throwsValidation(() => questionInput({ ...base, question: "   " }));
  throwsValidation(() => questionInput({ ...base, question: "س".repeat(HISTORY_LIMITS.question.max + 1) }));
});

test("question bounds: at most 40 atom ids of at most 80 characters", () => {
  const base = { surah: 2, depth: 1, stop: null, question: "سؤال", atomIds: ["a"] };
  assert.equal(questionInput({ ...base, atomIds: atoms(HISTORY_LIMITS.atomIds) }).atomIds.length, HISTORY_LIMITS.atomIds);
  throwsValidation(() => questionInput({ ...base, atomIds: atoms(HISTORY_LIMITS.atomIds + 1) }));
  throwsValidation(() => questionInput({ ...base, atomIds: ["x".repeat(HISTORY_LIMITS.atomIdChars + 1)] }));
  throwsValidation(() => questionInput({ ...base, atomIds: [""] }));
});

test("an absent askedAt stays undefined, a present one passes through", () => {
  const base = { surah: 2, depth: 1, stop: null, question: "سؤال", atomIds: [] };
  const without = questionInput(base);
  assert.equal(without.askedAt, undefined);
  assert.equal(questionInput({ ...base, askedAt: "2026-10-06T00:00:00.000Z" }).askedAt, "2026-10-06T00:00:00.000Z");
});
