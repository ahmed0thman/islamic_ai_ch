/** The saved record a signed-in reader carries across devices, and the bounds every layer shares. */

export interface HistoryProgress { surah: number; depth: number; stop: number | null; visited: number[]; updatedAt?: string }
export interface HistoryQuestion { surah: number; depth: number; stop: number | null; question: string; atomIds: string[]; askedAt?: string }
export type HistoryRecord = { progress: HistoryProgress[]; questions: HistoryQuestion[] };
export interface History extends HistoryRecord { signedIn: boolean }

export const HISTORY_LIMITS = {
  surah: { min: 1, max: 114 },
  depth: { min: 0, max: 3 },
  question: { min: 1, max: 500 },
  atomIdChars: 80,
  atomIds: 40,
  visited: 300,
  questionsPerSurah: 50,
} as const;
