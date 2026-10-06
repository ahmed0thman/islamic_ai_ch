/** The only file that holds history SQL: parameterised queries, and what it needs handed in, nothing read from the environment. */
// @ts-expect-error -- Node requires source extensions.
import { loadSql, schemaName, withSchema } from "../rag/db.ts";
import type pg from "pg";
// @ts-expect-error -- Node requires source extensions.
import { HISTORY_LIMITS } from "./types.ts";
import type { HistoryQuestion, HistoryProgress, HistoryRecord } from "./types";

let schemaOnce: Promise<void> | undefined;

/**
 * Applies the history schema through the same `withSchema` name the retrieval store uses, once per process.
 * A failure clears the cache so a later call retries.
 */
export function ensureSchema(pool: pg.Pool): Promise<void> {
  const cached = schemaOnce;
  if (cached) return cached;
  const run = pool.query(withSchema(loadSql("user-history.sql"), schemaName())).then(() => undefined);
  const tracked = run.catch((error: unknown) => {
    if (schemaOnce === tracked) schemaOnce = undefined;
    throw error;
  });
  schemaOnce = tracked;
  return tracked;
}

export async function findHistory(pool: pg.Pool, userId: string): Promise<HistoryRecord> {
  const [progress, questions] = await Promise.all([findProgress(pool, userId), findQuestions(pool, userId)]);
  return { progress, questions };
}

async function findProgress(pool: pg.Pool, userId: string): Promise<HistoryProgress[]> {
  const { rows } = await pool.query(
    withSchema("SELECT surah_no, depth, stop, visited, updated_at FROM rag.user_progress WHERE user_id = $1 ORDER BY surah_no", schemaName()),
    [userId],
  );
  return rows.map((row) => ({
    surah: row.surah_no,
    depth: row.depth,
    stop: row.stop,
    visited: row.visited ?? [],
    updatedAt: row.updated_at?.toISOString?.(),
  }));
}

/** Questions come newest first, fifty at most per surah. */
async function findQuestions(pool: pg.Pool, userId: string): Promise<HistoryQuestion[]> {
  const { rows } = await pool.query(
    withSchema("SELECT surah_no, depth, stop, question, atom_ids, asked_at FROM rag.user_questions WHERE user_id = $1 ORDER BY surah_no, asked_at DESC", schemaName()),
    [userId],
  );
  const perSurah = new Map<number, number>();
  const out: HistoryQuestion[] = [];
  for (const row of rows) {
    const seen = perSurah.get(row.surah_no) ?? 0;
    if (seen >= HISTORY_LIMITS.questionsPerSurah) continue;
    perSurah.set(row.surah_no, seen + 1);
    out.push({
      surah: row.surah_no,
      depth: row.depth,
      stop: row.stop,
      question: row.question,
      atomIds: row.atom_ids ?? [],
      askedAt: row.asked_at?.toISOString?.(),
    });
  }
  return out;
}

/** Upserts one surah's place; `visited` merges as a set union with the stored array, capped. */
export async function upsertProgress(pool: pg.Pool, userId: string, progress: Omit<HistoryProgress, "updatedAt">): Promise<void> {
  await pool.query(
    withSchema(
      `INSERT INTO rag.user_progress (user_id, surah_no, depth, stop, visited)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT array_agg(v ORDER BY v) FROM (SELECT DISTINCT unnest($5::int[]) AS v LIMIT $6) AS merged), '{}'))
       ON CONFLICT (user_id, surah_no) DO UPDATE SET
         depth = EXCLUDED.depth,
         stop = EXCLUDED.stop,
         visited = (SELECT array_agg(v ORDER BY v) FROM (SELECT DISTINCT unnest(rag.user_progress.visited || EXCLUDED.visited) AS v LIMIT $6) AS merged),
         updated_at = now()`,
      schemaName(),
    ),
    [userId, progress.surah, progress.depth, progress.stop, progress.visited, HISTORY_LIMITS.visited],
  );
}

/** One asked question; the unique key dedupes an exact repeat (same text at the same millisecond), the rest insert. */
export async function insertQuestion(pool: pg.Pool, userId: string, question: HistoryQuestion): Promise<void> {
  await pool.query(
    withSchema(
      "INSERT INTO rag.user_questions (user_id, surah_no, depth, stop, question, atom_ids, asked_at) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now())) ON CONFLICT DO NOTHING",
      schemaName(),
    ),
    [userId, question.surah, question.depth, question.stop, question.question, question.atomIds, question.askedAt ?? null],
  );
}
