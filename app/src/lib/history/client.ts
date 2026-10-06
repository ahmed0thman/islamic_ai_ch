/**
 * The reader's only way into the history server actions. Every call is gated on the sign-in flag and
 * imports the actions dynamically, so a static export (sign-in off) never loads any of their code,
 * and every failure is one typed answer, never an exception.
 */
import type { Result } from "../server/result";
import type { GetHistoryData, SaveData } from "./handlers";
import type { HistoryQuestion, HistoryProgress } from "./types";

const unavailable: Result<SaveData> = { ok: false, error: { code: "unavailable" } };

/** `null` when sign-in is off: the caller then keeps today's on-device behaviour, and nothing else happens. */
export async function getHistory(): Promise<Result<GetHistoryData> | null> {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") return null;
  try { return await (await import("@/lib/history/actions")).getHistoryAction(); } catch { return { ok: false, error: { code: "unavailable" } }; }
}

export async function saveProgress(input: Omit<HistoryProgress, "updatedAt">): Promise<Result<SaveData> | null> {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") return null;
  try { return await (await import("@/lib/history/actions")).saveProgressAction(input); } catch { return unavailable; }
}

export async function saveQuestion(input: HistoryQuestion): Promise<Result<SaveData> | null> {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") return null;
  try { return await (await import("@/lib/history/actions")).saveQuestionAction(input); } catch { return unavailable; }
}
