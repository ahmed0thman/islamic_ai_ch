// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { getPool, schemaName, withSchema } from "./db.ts";

export interface QuestionLog {
  question: string; surah: number; depth: number; stop: number | null; status: string; atomIds: string[];
  /** Numbers and fixed codes only. */
  retrieval: Record<string, unknown>;
}

/**
 * Keeps the reader's question for the build queue and the evaluation. Off unless `HUDA_ASK_LOG_QUESTIONS=1` (the owner has not decided).
 * Fire and forget: it never throws, never waits, and writes no identity and no network address. Nothing is written to any log line.
 */
export function logQuestion(entry: QuestionLog): void {
  if (process.env.HUDA_ASK_LOG_QUESTIONS !== "1") return;
  try {
    const pool = getPool();
    if (!pool) return;
    const sql = withSchema("INSERT INTO rag.questions (surah_no, depth, stop, question, status, atom_ids, retrieval) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)", schemaName());
    void pool.query(sql, [entry.surah, entry.depth, entry.stop, entry.question, entry.status, entry.atomIds.slice(0, 40), JSON.stringify(entry.retrieval)]).catch(() => undefined);
  } catch { /* Optional. */ }
}
