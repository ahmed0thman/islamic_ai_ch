import type { Atom, PublicAtom } from "./types";

/** The surah of a sentence: the field when set, else the number its id starts with (`108:1:blocks.2:0`). Source atoms carry the field. */
export function surahOf(atom: { id: string; surah?: number }): number | undefined {
  if (atom.surah !== undefined) return atom.surah;
  const match = /^(\d{1,3}):/.exec(atom.id);
  return match ? Number(match[1]) : undefined;
}

/** What leaves the server about a sentence: never its search text. */
export function publicAtom(atom: Atom): PublicAtom {
  const { id, level, role, segments, records, source } = atom;
  const surah = surahOf(atom);
  return { id, level, role, segments, records, ...(surah !== undefined ? { surah } : {}), ...(source ? { source } : {}) };
}
