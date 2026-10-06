import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { readHistoryHandler, saveProgressHandler, saveQuestionHandler } from "./handlers.ts";
import type { HistoryService } from "./handlers";
// @ts-expect-error -- Node requires source extensions.
import { UnavailableError } from "../server/errors.ts";
import type { HistoryRecord } from "./types";

const record: HistoryRecord = { progress: [{ surah: 2, depth: 1, stop: 3, visited: [1, 2] }], questions: [{ surah: 2, depth: 1, stop: 3, question: "س", atomIds: ["a"] }] };

/** A store seam: records what it was called with, and answers as its mode says. */
function store(mode: "ok" | "unavailable", calls: string[] = []): HistoryService {
  return {
    readHistory: async (userId) => { calls.push(`read:${userId}`); if (mode === "unavailable") throw new UnavailableError(); return record; },
    saveProgress: async (userId) => { calls.push(`progress:${userId}`); if (mode === "unavailable") throw new UnavailableError(); },
    saveQuestion: async (userId) => { calls.push(`question:${userId}`); if (mode === "unavailable") throw new UnavailableError(); },
  };
}

const place = { surah: 2, depth: 1, stop: 3, visited: [1] };
const asked = { surah: 2, depth: 1, stop: 3, question: "س", atomIds: ["a"] };

test("signed out (or sign-in off): the read is the empty signed-out shape and the store is never touched", async () => {
  const calls: string[] = [];
  const read = readHistoryHandler(store("ok", calls));
  assert.deepEqual(await read({ userId: null }, undefined), { signedIn: false, progress: [], questions: [] });
  const save = saveProgressHandler(store("ok", calls));
  assert.deepEqual(await save({ userId: null }, place), { saved: false });
  assert.deepEqual(await saveQuestionHandler(store("ok", calls))({ userId: null }, asked), { saved: false });
  assert.deepEqual(calls, []);
});

test("signed in with a database: the real record comes back and saves are confirmed", async () => {
  const calls: string[] = [];
  assert.deepEqual(await readHistoryHandler(store("ok", calls))({ userId: "u1" }, undefined), { signedIn: true, ...record });
  assert.deepEqual(await saveProgressHandler(store("ok", calls))({ userId: "u1" }, place), { saved: true });
  assert.deepEqual(await saveQuestionHandler(store("ok", calls))({ userId: "u1" }, asked), { saved: true });
  assert.deepEqual(calls, ["read:u1", "progress:u1", "question:u1"]);
});

test("signed in without a database: the read degrades to empty and the saves say not saved, never an error", async () => {
  const seam = store("unavailable");
  assert.deepEqual(await readHistoryHandler(seam)({ userId: "u1" }, undefined), { signedIn: true, progress: [], questions: [] });
  assert.deepEqual(await saveProgressHandler(seam)({ userId: "u1" }, place), { saved: false });
  assert.deepEqual(await saveQuestionHandler(seam)({ userId: "u1" }, asked), { saved: false });
});

test("a failure that is not a storage failure is not swallowed", async () => {
  const breaking: HistoryService = {
    readHistory: async () => { throw new Error("bug"); },
    saveProgress: async () => { throw new Error("bug"); },
    saveQuestion: async () => { throw new Error("bug"); },
  };
  await assert.rejects(() => readHistoryHandler(breaking)({ userId: "u1" }, undefined));
});
