import guard from "./source-guard.json" with { type: "json" };
// @ts-expect-error -- Node requires source extensions.
import { normalizeSearch } from "./normalize.ts";

/**
 * The runtime guard for weaving from book passages (decision 086). Its strings are normalised the `normalizeSearch` way, so everything here
 * matches with `normalizeSearch`, never with the answer guard's `normalize`.
 */
const sequences = (list: readonly string[]): string[][] => list.map((item) => item.split(/\s+/u).filter(Boolean)).filter((item) => item.length > 0);

/** Sources that collect narrations: their passages are never woven. */
export const REPORT_SOURCES: ReadonlySet<string> = new Set(guard.report_sources);
/** A transmission chain begins after one of these: the whole passage is dropped. */
export const CHAIN_MARKERS: readonly string[][] = sequences(guard.chain_markers);
/** Formulas of reporting a narration: the unit that holds one and the unit after it are dropped; a written sentence that holds one is rejected. */
export const REPORT_MARKERS: readonly string[][] = sequences(guard.report_markers);

/** Letters and digits only, after the search normalisation. */
export const guardTokens = (text: string): string[] => normalizeSearch(text).match(/[\p{L}\p{N}]+/gu) ?? [];

// One attached conjunction or preposition (and, so, by, to) before the first word of a marker still counts as that word: a narration formula is
// not safer for being written with its «and». This only ever drops more, never less, than whole-token matching.
const ATTACHED = new RegExp("^[" + String.fromCodePoint(0x648, 0x641, 0x628, 0x644) + "]", "u");
const sameWord = (word: string, marker: string) => word === marker || (word.length > marker.length && ATTACHED.test(word) && word.slice(1) === marker);

/** Whether the token list holds any of the marker sequences as consecutive whole tokens. */
export function hasMarker(tokens: readonly string[], markers: readonly (readonly string[])[]): boolean {
  for (const marker of markers) {
    for (let at = 0; at + marker.length <= tokens.length; at++) {
      if (!sameWord(tokens[at], marker[0])) continue;
      let all = true;
      for (let k = 1; k < marker.length; k++) if (tokens[at + k] !== marker[k]) { all = false; break; }
      if (all) return true;
    }
  }
  return false;
}
