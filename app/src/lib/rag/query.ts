// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { normalizeSearch as normalize } from "../ask/normalize.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { STOPWORDS } from "./stopwords.ts";

const MAX_TOKENS = 32;
const MAX_TOKEN_LENGTH = 40;

/** Content words of a question: normalised, letters and digits only, at least two characters, no stop word, each once. */
export function tokenize(question: string, stopwords: ReadonlySet<string> = STOPWORDS): string[] {
  const seen = new Set<string>();
  for (const word of normalize(question).match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (word.length < 2 || word.length > MAX_TOKEN_LENGTH || stopwords.has(word)) continue;
    seen.add(word);
    if (seen.size === MAX_TOKENS) break;
  }
  return [...seen];
}

/**
 * The text given to `to_tsquery('arabic', ...)`: the tokens joined by `|` (any of them may match).
 * Tokens hold letters and digits only, so no tsquery operator or quote can come from the question. Empty when no content word is left.
 */
export function tsQueryText(question: string, stopwords: ReadonlySet<string> = STOPWORDS): string {
  return tokenize(question, stopwords).join(" | ");
}

export interface Fused { id: string; score: number }
/**
 * Reciprocal rank fusion: each list gives an id the score 1 / (k + rank), rank starting at 1; scores add up across lists.
 * `boosts` are added afterwards. Ties break on the id, as in the SQL (`ORDER BY score DESC, id`).
 * The SQL in app/db/search_*.sql computes the same numbers; the integration test compares them.
 */
export function fuse(lists: readonly (readonly string[])[], boosts: ReadonlyMap<string, number> = new Map(), k = 60): Fused[] {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  for (const [id, boost] of boosts) if (scores.has(id)) scores.set(id, scores.get(id)! + boost);
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
