/** The history action handlers, with the service injected so tests substitute a store instead of mocking modules. */
// @ts-expect-error -- Node requires source extensions.
import { UnavailableError } from "../server/errors.ts";
import type { ActionContext } from "../server/action";
import type { HistoryQuestion, HistoryProgress, HistoryRecord } from "./types";

export interface HistoryService {
  readHistory(userId: string): Promise<HistoryRecord>;
  saveProgress(userId: string, progress: Omit<HistoryProgress, "updatedAt">): Promise<void>;
  saveQuestion(userId: string, question: HistoryQuestion): Promise<void>;
}

export type GetHistoryData = { signedIn: boolean } & HistoryRecord;
export type SaveData = { saved: boolean };

type Handler<I, O> = (ctx: ActionContext, input: I) => Promise<O>;

export function readHistoryHandler(store: HistoryService): Handler<void, GetHistoryData> {
  return async ({ userId }) => {
    if (userId === null) return { signedIn: false, progress: [], questions: [] };
    try {
      return { signedIn: true, ...(await store.readHistory(userId)) };
    } catch (error) {
      if (error instanceof UnavailableError) return { signedIn: true, progress: [], questions: [] };
      throw error;
    }
  };
}

export function saveProgressHandler(store: HistoryService): Handler<Omit<HistoryProgress, "updatedAt">, SaveData> {
  return async ({ userId }, progress) => {
    if (userId === null) return { saved: false };
    try {
      await store.saveProgress(userId, progress);
      return { saved: true };
    } catch (error) {
      if (error instanceof UnavailableError) return { saved: false };
      throw error;
    }
  };
}

export function saveQuestionHandler(store: HistoryService): Handler<HistoryQuestion, SaveData> {
  return async ({ userId }, question) => {
    if (userId === null) return { saved: false };
    try {
      await store.saveQuestion(userId, question);
      return { saved: true };
    } catch (error) {
      if (error instanceof UnavailableError) return { saved: false };
      throw error;
    }
  };
}
