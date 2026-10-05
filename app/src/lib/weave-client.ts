// @ts-expect-error -- Node tests require explicit source extensions.
import { askedAt } from "./asked.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { composedView } from "./ask-composed-view.ts";
import type { AskedQuestion } from "./asked";
import type { AskResponse } from "./ask/types";
import type { Depth } from "./types";

export interface WeaveInput { surah: number; depth: Depth; stop: number; questions: string[] }
export const weaveKey = ({ surah, depth, stop }: Pick<WeaveInput, "surah" | "depth" | "stop">) => `${surah}:${depth}:${stop}`;

/** Local-stop questions first, then other questions of this surah, newest first within each group. */
export function weaveQuestions(list: AskedQuestion[], depth: Depth, stop: number): string[] {
  const entries = list.map((item) => ({ item }));
  const local = askedAt(entries, depth, stop);
  const ids = new Set(local.map(({ item }) => item.id));
  const ordered = [...local, ...entries.filter(({ item }) => !ids.has(item.id))];
  return [...new Set(ordered.map(({ item }) => [...item.question.trim()].slice(0, 300).join("")).filter(Boolean))].slice(0, 5);
}

/** One in-memory cache per browser session, never device storage. Failed requests can be tried again. */
export function createWeaveClient(send: typeof fetch = fetch) {
  const cache = new Map<string, AskResponse>();
  return async (input: WeaveInput, signal?: AbortSignal): Promise<AskResponse | null> => {
    try {
      signal?.throwIfAborted();
      const key = weaveKey(input);
      const cached = cache.get(key);
      if (cached) return cached;
      if (!input.questions.length) return null;
      const response = await send("/api/weave/", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
        signal: AbortSignal.any([AbortSignal.timeout(35_000), ...(signal ? [signal] : [])]),
      });
      if (!response.ok) return null;
      const result = await response.json() as AskResponse;
      signal?.throwIfAborted();
      if (!result || !Array.isArray(result.atoms) || result.status !== "answer" || result.mode !== "composed") return null;
      const items = composedView(result);
      // Every sentence on this card must have a source marker, including after a partial server failure.
      if (!items || items.length < 2 || items.some((item) => item.kind !== "written" || !item.records.length)) return null;
      cache.set(key, result);
      return result;
    } catch { return null; }
  };
}

export const requestWeave = createWeaveClient();
