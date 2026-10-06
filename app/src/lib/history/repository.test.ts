import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { ensureSchema, findHistory, insertQuestion, upsertProgress } from "./repository.ts";
// @ts-expect-error -- Node requires source extensions.
import { getPool } from "../rag/db.ts";
// @ts-expect-error -- Node requires source extensions.
import { HISTORY_LIMITS } from "./types.ts";
import type { HistoryQuestion } from "./types";

// The round trip runs only where a database is configured, in a throwaway schema the test removes afterwards.
const skip = process.env.DATABASE_URL ? false : "DATABASE_URL is not set (the round trip needs a local Postgres)";
process.env.HUDA_RAG_SCHEMA = "rag_history_test";

const place = { surah: 2, depth: 1, stop: 3, visited: [5, 2] };
const asked: HistoryQuestion = { surah: 2, depth: 1, stop: 3, question: "سؤال", atomIds: ["2:255:blocks.0:0"], askedAt: "2026-10-06T10:00:00.000Z" };

test("integration: schema, progress merge, question insert and read-back", { skip }, async (t) => {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is set but no pool was created");
  t.after(async () => { await pool.query("DROP SCHEMA IF EXISTS rag_history_test CASCADE"); await pool.end(); });

  await ensureSchema(pool);
  await ensureSchema(pool); // idempotent, and the once-per-process cache answers without running the file again

  await upsertProgress(pool, "reader-1", place);
  await upsertProgress(pool, "reader-1", { ...place, depth: 2, visited: [2, 7] });
  const stored = await findHistory(pool, "reader-1");
  assert.deepEqual(stored.progress, [{ surah: 2, depth: 2, stop: 3, visited: [2, 5, 7], updatedAt: stored.progress[0]?.updatedAt }]);

  await insertQuestion(pool, "reader-1", asked);
  await insertQuestion(pool, "reader-1", asked); // the unique key dedupes an exact repeat of the same question at the same time
  await insertQuestion(pool, "reader-1", { ...asked, surah: 1, askedAt: undefined });
  assert.equal((await findHistory(pool, "reader-1")).questions.length, 2);

  await upsertProgress(pool, "reader-2", { surah: 1, depth: 0, stop: null, visited: Array.from({ length: HISTORY_LIMITS.visited + 50 }, (_, index) => index) });
  const merged = await findHistory(pool, "reader-2");
  assert.equal(merged.progress[0]?.visited.length, HISTORY_LIMITS.visited);
});

test("without DATABASE_URL there is no pool and the service says unavailable", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    // @ts-expect-error -- Node requires source extensions.
    const { readHistory } = await import("./service.ts");
    // @ts-expect-error -- Node requires source extensions.
    const { UnavailableError } = await import("../server/errors.ts");
    await assert.rejects(() => readHistory("reader-1"), (error: unknown) => error instanceof UnavailableError);
  } finally { process.env.DATABASE_URL = saved; }
});
