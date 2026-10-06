/** The pure rules of the signed-in reader's history: merging the account's questions into the device list, the resume decision, progress diffing and the history rows. No framework, storage or server here. */
// @ts-expect-error -- Node requires source extensions.
import { maxAsked } from "../asked.ts";
import type { AskedQuestion } from "../asked";
import type { Depth } from "../types";
// @ts-expect-error -- Node requires source extensions.
import { HISTORY_LIMITS } from "./types.ts";
import type { HistoryQuestion, HistoryProgress, HistoryRecord } from "./types";

/** The least a stop needs to be found again: its URL number and its block, for the visited keys the reader holds. */
export interface UnitRef { readonly number: number; readonly blockIndex: number }

const isDepth = (value: number): value is Depth => value === 0 || value === 1 || value === 2 || value === 3;

/**
 * The account's questions for one surah joined with what the device holds. A question is the same
 * when its text and its time agree; the rest join the device list, which keeps its own cap and shape.
 * Malformed account rows (empty question, no sentences, an impossible depth or stop) drop silently.
 */
export function mergeQuestions(device: readonly AskedQuestion[], server: readonly HistoryQuestion[], surahNo: number): AskedQuestion[] {
  const combined = [...device];
  const seen = new Set(device.map((item) => `${item.question}\u0000${item.at}`));
  for (const item of server) {
    if (item.surah !== surahNo || item.question.length === 0 || item.atomIds.length === 0) continue;
    if (item.stop !== null && !(Number.isInteger(item.stop) && item.stop > 0)) continue;
    if (!isDepth(item.depth)) continue;
    const at = item.askedAt ? Date.parse(item.askedAt) : NaN;
    if (!Number.isFinite(at)) continue;
    const key = `${item.question}\u0000${at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let id = String(at), counter = 1;
    while (combined.some((known) => known.id === id)) id = `${at}-${counter++}`;
    combined.push({ id, question: item.question, atomIds: [...item.atomIds], depth: item.depth, stop: item.stop, at });
  }
  return combined.sort((a, b) => b.at - a.at).slice(0, maxAsked);
}

/**
 * Where to offer resuming, if at all: the account must hold a stop for this surah, the URL must carry
 * no place of its own, and the saved stop must not be the first one (nothing to resume from there).
 */
export function resumeTarget(
  progress: HistoryProgress | undefined,
  params: { readonly d: string | null; readonly stop: string | null },
  unitsOf: (depth: number) => readonly UnitRef[],
): { depth: Depth; stop: number } | null {
  if (!progress || params.d !== null || params.stop !== null) return null;
  if (progress.stop === null || !isDepth(progress.depth)) return null;
  const units = unitsOf(progress.depth);
  if (!units.some((unit) => unit.number === progress.stop)) return null;
  if (units[0]?.number === progress.stop) return null;
  return { depth: progress.depth, stop: progress.stop };
}

/** One surah's place, as it is saved: the level, the open stop and the visited stops as numbers. */
export interface ProgressSnapshot { readonly depth: Depth; readonly stop: number | null; readonly visited: readonly number[] }

export function snapshotOf(depth: Depth, stop: number | null, visited: readonly number[]): ProgressSnapshot {
  return { depth, stop, visited: [...new Set(visited)].sort((a, b) => a - b) };
}

/** Whether a snapshot differs from the one this visit started from (or from the last one sent). */
export function progressDiffers(previous: ProgressSnapshot | null, next: ProgressSnapshot): boolean {
  if (!previous) return true;
  return previous.depth !== next.depth || previous.stop !== next.stop
    || previous.visited.length !== next.visited.length
    || previous.visited.some((value, at) => value !== next.visited[at]);
}

/** The account's visited stop numbers turned into the reader's `${depth}:${blockIndex}` keys; unknown numbers drop. */
export function visitedToKeys(visited: readonly number[], depth: number, units: readonly UnitRef[]): string[] {
  if (!isDepth(depth)) return [];
  const blocks = new Map(units.map((unit) => [unit.number, unit.blockIndex]));
  return visited.flatMap((number) => blocks.has(number) ? [`${depth}:${blocks.get(number)}`] : []);
}

export interface AskedEntryInput { readonly question: string; readonly atomIds: readonly string[]; readonly depth: Depth; readonly stop: number | null; readonly at: number }

/** An asked question clipped to what the account's validators accept, with its time as an ISO instant. */
export function questionRecord(surahNo: number, entry: AskedEntryInput): HistoryQuestion {
  return {
    surah: surahNo,
    depth: entry.depth,
    stop: entry.stop,
    question: entry.question.slice(0, HISTORY_LIMITS.question.max),
    atomIds: entry.atomIds.slice(0, HISTORY_LIMITS.atomIds).map((id) => id.slice(0, HISTORY_LIMITS.atomIdChars)),
    askedAt: new Date(entry.at).toISOString(),
  };
}

/** One row of the history list: a surah with something saved, newest first by the last thing that happened in it. */
export interface HistoryRow { surah: number; depth: number; stop: number | null; visited: number; questions: number; lastSeen: number }

export function historyRows(record: HistoryRecord): HistoryRow[] {
  const rows = new Map<number, HistoryRow>();
  for (const item of record.progress) {
    if (item.surah < HISTORY_LIMITS.surah.min || item.surah > HISTORY_LIMITS.surah.max || !isDepth(item.depth)) continue;
    const updatedAt = item.updatedAt ? Date.parse(item.updatedAt) : NaN;
    rows.set(item.surah, { surah: item.surah, depth: item.depth, stop: item.stop, visited: item.visited.length, questions: 0, lastSeen: Number.isFinite(updatedAt) ? updatedAt : 0 });
  }
  for (const item of record.questions) {
    if (item.surah < HISTORY_LIMITS.surah.min || item.surah > HISTORY_LIMITS.surah.max || !isDepth(item.depth)) continue;
    const askedAt = item.askedAt ? Date.parse(item.askedAt) : NaN;
    const at = Number.isFinite(askedAt) ? askedAt : 0;
    const row = rows.get(item.surah);
    if (row) { row.questions += 1; row.lastSeen = Math.max(row.lastSeen, at); continue; }
    rows.set(item.surah, { surah: item.surah, depth: item.depth, stop: item.stop, visited: 0, questions: 1, lastSeen: at });
  }
  return [...rows.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}
