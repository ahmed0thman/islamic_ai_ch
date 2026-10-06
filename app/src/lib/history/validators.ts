/** The history inputs, built from the shared validator primitives; validated once, in the action wrapper. */
// @ts-expect-error -- Node requires source extensions.
import { arrayOf, int, nullable, object, optional, text } from "../server/validate.ts";
import type { Validator } from "../server/validate";
// @ts-expect-error -- Node requires source extensions.
import { HISTORY_LIMITS } from "./types.ts";
import type { HistoryQuestion, HistoryProgress } from "./types";

const nonNegative = int({ min: 0, max: Number.MAX_SAFE_INTEGER });
const atomId = text({ min: 1, max: HISTORY_LIMITS.atomIdChars });

const surah = int({ min: HISTORY_LIMITS.surah.min, max: HISTORY_LIMITS.surah.max });
const depth = int({ min: HISTORY_LIMITS.depth.min, max: HISTORY_LIMITS.depth.max });
const stop = nullable(nonNegative);

export const progressInput: Validator<Omit<HistoryProgress, "updatedAt">> = object({
  surah,
  depth,
  stop,
  visited: arrayOf(nonNegative, { max: HISTORY_LIMITS.visited }),
});

export const questionInput: Validator<HistoryQuestion> = object({
  surah,
  depth,
  stop,
  question: text({ min: HISTORY_LIMITS.question.min, max: HISTORY_LIMITS.question.max, trim: true }),
  atomIds: arrayOf(atomId, { max: HISTORY_LIMITS.atomIds }),
  askedAt: optional(text({ min: 1, max: 40 })),
});
