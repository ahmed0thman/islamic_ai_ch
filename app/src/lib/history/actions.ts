"use server";

// @ts-expect-error -- Node requires source extensions.
import { createAction } from "../server/action.ts";
import type { Result } from "../server/result";
// @ts-expect-error -- Node requires source extensions.
import { readHistoryHandler, saveProgressHandler, saveQuestionHandler } from "./handlers.ts";
// @ts-expect-error -- Node requires source extensions.
import * as service from "./service.ts";
import type { GetHistoryData, SaveData } from "./handlers";
import type { HistoryQuestion, HistoryProgress } from "./types";
// @ts-expect-error -- Node requires source extensions.
import { progressInput, questionInput } from "./validators.ts";

const getHistory = createAction<void, GetHistoryData>({ auth: "optional", handler: readHistoryHandler(service) });
const saveProgress = createAction<Omit<HistoryProgress, "updatedAt">, SaveData>({ auth: "optional", input: progressInput, handler: saveProgressHandler(service) });
const saveQuestion = createAction<HistoryQuestion, SaveData>({ auth: "optional", input: questionInput, handler: saveQuestionHandler(service) });

export async function getHistoryAction(): Promise<Result<GetHistoryData>> {
  return getHistory(undefined);
}

export async function saveProgressAction(raw: unknown): Promise<Result<SaveData>> {
  return saveProgress(raw);
}

export async function saveQuestionAction(raw: unknown): Promise<Result<SaveData>> {
  return saveQuestion(raw);
}
