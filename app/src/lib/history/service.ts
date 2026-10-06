/** The history service: pure feature rules over the repository, no SQL and no framework imports. */
// @ts-expect-error -- Node requires source extensions.
import { getPool } from "../rag/db.ts";
// @ts-expect-error -- Node requires source extensions.
import { AppError, UnavailableError } from "../server/errors.ts";
// @ts-expect-error -- Node requires source extensions.
import { ensureSchema, findHistory, insertQuestion, upsertProgress } from "./repository.ts";
import type pg from "pg";
import type { HistoryQuestion, HistoryProgress, HistoryRecord } from "./types";

/** Every failure of the storage behind the history is one typed answer: the feature degrades, reading never breaks. */
async function withStorage<T>(run: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) throw new UnavailableError("no database pool");
  try {
    await ensureSchema(pool);
    return await run(pool);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new UnavailableError("history storage unavailable");
  }
}

export async function readHistory(userId: string): Promise<HistoryRecord> {
  return withStorage((pool) => findHistory(pool, userId));
}

export async function saveProgress(userId: string, progress: Omit<HistoryProgress, "updatedAt">): Promise<void> {
  await withStorage((pool) => upsertProgress(pool, userId, progress));
}

export async function saveQuestion(userId: string, question: HistoryQuestion): Promise<void> {
  await withStorage((pool) => insertQuestion(pool, userId, question));
}
