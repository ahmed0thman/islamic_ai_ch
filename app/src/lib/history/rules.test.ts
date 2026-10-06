import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { historyRows, mergeQuestions, progressDiffers, questionRecord, resumeTarget, snapshotOf, visitedToKeys } from "./rules.ts";
import type { AskedQuestion } from "../asked";
import type { HistoryQuestion, HistoryProgress, HistoryRecord } from "./types";

const device = (over: Partial<AskedQuestion>): AskedQuestion => ({ id: "10", question: "س", atomIds: ["a"], depth: 1, stop: 2, at: 10, ...over });
const serverQuestion = (over: Partial<HistoryQuestion>): HistoryQuestion => ({ surah: 2, depth: 1, stop: 2, question: "س", atomIds: ["a"], ...over });
const units = (depth: number) => (depth === 1 ? [{ number: 1, blockIndex: 4 }, { number: 2, blockIndex: 7 }, { number: 3, blockIndex: 9 }] : [{ number: 1, blockIndex: 0 }]);

test("merge: account questions the device lacks join the device list, newest first, at the device cap", () => {
  const held = [device({ id: "10", at: 10, question: "الأولى" }), device({ id: "5", at: 5, question: "الثانية" })];
  const account = [serverQuestion({ question: "الجديدة", askedAt: new Date(20).toISOString() }), serverQuestion({ question: "الأولى", askedAt: new Date(10).toISOString() })];
  const merged = mergeQuestions(held, account, 2);
  assert.deepEqual(merged.map((item) => item.question), ["الجديدة", "الأولى", "الثانية"]);
  assert.deepEqual(merged[0], { id: "20", question: "الجديدة", atomIds: ["a"], depth: 1, stop: 2, at: 20 });
});

test("merge: a question the account and the device both hold (same text and time) is not duplicated", () => {
  const held = [device({ at: 10 })];
  const account = [serverQuestion({ askedAt: new Date(10).toISOString() })];
  assert.deepEqual(mergeQuestions(held, account, 2), held);
});

test("merge: rows of other surahs and malformed rows drop, and the list never passes fifty", () => {
  const held: AskedQuestion[] = Array.from({ length: 50 }, (_, at) => device({ id: String(100 - at), at: 100 - at }));
  const account = [
    serverQuestion({ surah: 3 }),
    serverQuestion({ question: "" }),
    serverQuestion({ atomIds: [] }),
    serverQuestion({ depth: 9 }),
    serverQuestion({ stop: 0 }),
    serverQuestion({ askedAt: undefined }),
    serverQuestion({ question: "صالحة", askedAt: new Date(200).toISOString() }),
  ];
  const merged = mergeQuestions(held, account, 2);
  assert.equal(merged.length, 50);
  assert.equal(merged[0].question, "صالحة");
});

test("merge: an added id never collides with one the device holds", () => {
  const held = [device({ id: "20", at: 20 })];
  const account = [serverQuestion({ question: "مختلفة", askedAt: new Date(20).toISOString() })];
  const merged = mergeQuestions(held, account, 2);
  assert.deepEqual(merged.map((item) => item.id), ["20", "20-1"]);
});

test("resume: the saved stop is offered when the URL carries no place and the stop is not the first", () => {
  const progress: HistoryProgress = { surah: 2, depth: 1, stop: 3, visited: [2] };
  assert.deepEqual(resumeTarget(progress, { d: null, stop: null }, units), { depth: 1, stop: 3 });
});

test("resume: nothing is offered when the URL names a depth or a stop, when nothing is saved, or when the saved stop is the first", () => {
  const progress: HistoryProgress = { surah: 2, depth: 1, stop: 3, visited: [] };
  assert.equal(resumeTarget(progress, { d: "2", stop: null }, units), null);
  assert.equal(resumeTarget(progress, { d: null, stop: "1" }, units), null);
  assert.equal(resumeTarget(undefined, { d: null, stop: null }, units), null);
  assert.equal(resumeTarget({ ...progress, stop: null }, { d: null, stop: null }, units), null);
  assert.equal(resumeTarget({ ...progress, stop: 1 }, { d: null, stop: null }, units), null);
  assert.equal(resumeTarget({ ...progress, depth: 9 }, { d: null, stop: null }, units), null);
  assert.equal(resumeTarget({ ...progress, stop: 7 }, { d: null, stop: null }, units), null);
});

test("progress: a snapshot differs from the session's start, or from the last one sent, only when something moved", () => {
  const start = snapshotOf(1, 2, [1, 2]);
  assert.equal(progressDiffers(null, start), true);
  assert.equal(progressDiffers(start, snapshotOf(1, 2, [2, 1])), false);
  assert.equal(progressDiffers(start, snapshotOf(1, 2, [1, 2, 3])), true);
  assert.equal(progressDiffers(start, snapshotOf(1, 3, [1, 2])), true);
  assert.equal(progressDiffers(start, snapshotOf(2, 2, [1, 2])), true);
});

test("visited: the account's stop numbers become the reader's keys of that depth, unknown numbers drop", () => {
  assert.deepEqual(visitedToKeys([1, 3, 7], 1, units(1)), ["1:4", "1:9"]);
  assert.deepEqual(visitedToKeys([1], 1, []), []);
  assert.deepEqual(visitedToKeys([1], 9, units(1)), []);
});

test("question: an asked entry becomes the account's shape with its bounds and its time as an instant", () => {
  assert.deepEqual(questionRecord(2, { question: "س".repeat(600), atomIds: ["a".repeat(100), "b"], depth: 1, stop: 2, at: Date.UTC(2026, 9, 6) }),
    { surah: 2, depth: 1, stop: 2, question: "س".repeat(500), atomIds: ["a".repeat(80), "b"], askedAt: new Date(Date.UTC(2026, 9, 6)).toISOString() });
});

test("rows: one row per surah with progress or questions, newest first, both joined for one surah", () => {
  const record: HistoryRecord = {
    progress: [
      { surah: 2, depth: 1, stop: 3, visited: [1, 2], updatedAt: new Date(100).toISOString() },
      { surah: 9, depth: 9, stop: null, visited: [], updatedAt: new Date(50).toISOString() },
    ],
    questions: [
      { surah: 2, depth: 1, stop: 3, question: "س", atomIds: ["a"], askedAt: new Date(300).toISOString() },
      { surah: 5, depth: 1, stop: null, question: "س", atomIds: ["a"], askedAt: new Date(200).toISOString() },
      { surah: 2, depth: 1, stop: 3, question: "س", atomIds: ["a"], askedAt: new Date(150).toISOString() },
    ],
  };
  assert.deepEqual(historyRows(record), [
    { surah: 2, depth: 1, stop: 3, visited: 2, questions: 2, lastSeen: 300 },
    { surah: 5, depth: 1, stop: null, visited: 0, questions: 1, lastSeen: 200 },
  ]);
});
