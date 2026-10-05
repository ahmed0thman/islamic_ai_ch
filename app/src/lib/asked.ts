import type { Depth } from "./types";
import type { AskExtra, PublicAtom } from "./ask/types";

/**
 * What the reader asked, kept on the device alone. A question stores the ids of the sentences that answered it, never their text:
 * the sentences are derived from the surah's content again on every view, so a changed content drops the question instead of showing stale words.
 */
export interface AskedQuestion {
  /** Stable id of this entry: the time it was asked, plus a counter when two share a millisecond. */
  id: string;
  question: string;
  /** Sentence ids as `deriveAtoms` makes them. */
  atomIds: string[];
  /** The depth the reader was at. */
  depth: Depth;
  /** The stop open when asked (its number at that depth), or null when none was. */
  stop: number | null;
  /** Epoch milliseconds. */
  at: number;
  /** The sentences of the answer that this surah's content cannot give back by id (a book excerpt, or a sentence of another surah), as they were shown. */
  held?: PublicAtom[];
  /** The records and ayahs the held sentences of other surahs need. */
  heldContext?: AskExtra;
}
/** The most a device keeps per surah; the oldest go first. */
export const maxAsked = 50;
export const askedStorageKey = (surahNo: number) => `huda:asked:v1:${surahNo}`;

const isDepth = (value: unknown): value is Depth => value === 0 || value === 1 || value === 2 || value === 3;
function valid(value: unknown): value is AskedQuestion {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.question === "string" && item.question.length > 0
    && Array.isArray(item.atomIds) && item.atomIds.length > 0 && item.atomIds.every((id) => typeof id === "string")
    && isDepth(item.depth) && (item.stop === null || (typeof item.stop === "number" && Number.isInteger(item.stop) && item.stop > 0))
    && typeof item.at === "number" && Number.isFinite(item.at);
}
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validHeld = (value: unknown): value is PublicAtom => isObject(value) && typeof value.id === "string" && Array.isArray(value.segments) && Array.isArray(value.records)
  && (value.role === "claim" || value.role === "transmission" || value.role === "source") && isDepth(value.level)
  && (value.role !== "source" || (isObject(value.source) && typeof value.source.title === "string" && typeof value.source.author === "string" && typeof value.source.locator === "string"));
const validContext = (value: unknown): value is AskExtra => isObject(value) && isObject(value.records) && Array.isArray(value.ayahs);
/** What an older version wrote has no held sentences, and a malformed one is dropped (the entry then resolves from the content alone). */
const withHeld = (item: AskedQuestion): AskedQuestion => {
  const { held, heldContext, ...rest } = item;
  const goodHeld = Array.isArray(held) && held.every(validHeld) ? held : undefined;
  return { ...rest, ...(goodHeld?.length ? { held: goodHeld } : {}), ...(goodHeld?.length && validContext(heldContext) ? { heldContext } : {}) };
};
/** Anything unreadable gives an empty list: storage is optional and may hold what an older version wrote. Newest first. */
export function parseAsked(raw: string | null): AskedQuestion[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).map(withHeld).sort((a, b) => b.at - a.at).slice(0, maxAsked) : [];
  } catch { return []; }
}
export const serializeAsked = (list: AskedQuestion[]) => JSON.stringify(list.slice(0, maxAsked));
/** The same question asked again at the same place replaces the older entry; the list stays newest first and at most `maxAsked` long. */
export function addAsked(list: AskedQuestion[], entry: Omit<AskedQuestion, "id">): AskedQuestion[] {
  const same = (item: AskedQuestion) => item.depth === entry.depth && item.stop === entry.stop && item.question === entry.question;
  const kept = list.filter((item) => !same(item));
  let id = String(entry.at), counter = 1;
  while (kept.some((item) => item.id === id)) id = `${entry.at}-${counter++}`;
  return [{ ...entry, id }, ...kept].sort((a, b) => b.at - a.at).slice(0, maxAsked);
}
export const removeAsked = (list: AskedQuestion[], id: string) => list.filter((item) => item.id !== id);
/** Entries whose every sentence still exists, with those sentences in the order the answer had them. The rest drop silently. */
export function resolveAsked<T extends { id: string }>(list: AskedQuestion[], atoms: ReadonlyMap<string, T>): { item: AskedQuestion; atoms: (T | PublicAtom)[] }[] {
  const resolved: { item: AskedQuestion; atoms: (T | PublicAtom)[] }[] = [];
  for (const item of list) {
    const held = new Map((item.held ?? []).map((atom) => [atom.id, atom]));
    // The content wins for its own sentences (changed content drops the question); only what the content cannot give back comes from what was held.
    const found = item.atomIds.map((id) => atoms.get(id) ?? held.get(id));
    if (found.every((atom): atom is T | PublicAtom => atom !== undefined)) resolved.push({ item, atoms: found });
  }
  return resolved;
}
/** Where a question is shown: in the scene of its stop at its depth, or, asked with no stop open, on the closing screen of its depth. */
export const askedAt = <T extends { item: AskedQuestion }>(list: T[], depth: Depth, stop: number | null) =>
  list.filter(({ item }) => item.depth === depth && item.stop === stop);
