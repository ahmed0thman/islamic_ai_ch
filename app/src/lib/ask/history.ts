// @ts-expect-error -- Node requires source extensions.
import { composedView } from "../ask-composed-view.ts";
// @ts-expect-error -- Node requires source extensions.
import { normalizeSearch } from "./normalize.ts";
import type { Segment } from "../types";
import type { AskResponse, HistoryTurn, PublicAtom } from "./types";

export const HISTORY_TURNS = 2;
export const HISTORY_TEXT_CHARS = 600;
const HISTORY_ATOMS = 8;
const clip = (text: string) => [...text.trim()].slice(0, HISTORY_TEXT_CHARS).join("");

/**
 * A message that is not a question of its own but follows up on the earlier one. The rule: at most six words, every word from the three lists below,
 * and at least one of them from the first two. So "search again" and "explain more" are follow-ups, and "explain the third ayah" is a question.
 * The lists are compared after the search normalisation.
 */
export const FOLLOW_UP_MAX_WORDS = 6;
/** Search again. */
const AGAIN = ["ابحث", "ابحثي", "دوّر", "حاول", "جرّب", "أعد", "إعادة", "البحث", "بحث", "مرة", "أخرى", "ثانية", "ثاني", "تاني", "تانية", "كمان", "مجددًا", "جديد"];
/** Explain, expand, simplify, shorten, give an example, or a bare "what do you mean", "why", "how". */
const MORE = ["وضّح", "وضّحها", "وضّحلي", "أوضح", "توضيح", "التوضيح", "اشرح", "اشرحها", "اشرحلي", "شرح", "فصّل", "فصّلها", "تفصيل", "التفصيل", "بالتفصيل", "بتفصيل",
  "أكثر", "أكتر", "زد", "زدني", "زيادة", "المزيد", "مزيد", "كمّل", "كمّلي", "أكمل", "تابع", "استمر", "بسّط", "بسّطها", "أبسط", "تبسيط", "ببساطة", "أسهل", "اختصر", "اختصرها", "باختصار", "لخّص",
  "مثال", "مثالًا", "أمثلة", "يعني", "إيه", "ماذا", "تقصد", "قصدك", "المقصود", "فاهم", "فهمت", "أفهم", "لماذا", "ليه", "كيف", "إزاي"];
/** Words that carry nothing by themselves. */
const FILLER = ["من", "فضلك", "لو", "سمحت", "طيب", "ممكن", "أرجو", "رجاء", "مش", "لم", "ما", "لا", "هذا", "هذه", "ده", "دي", "ذلك", "كده", "هكذا", "لي", "و", "ثم", "بس",
  "أعطني", "اعطيني", "هات", "أريد", "عايز", "في", "عن", "بشكل", "بطريقة", "شوية", "قليلًا", "يا", "ريت"];
const wordSet = (list: string[]) => new Set(list.map(normalizeSearch));
const again = wordSet(AGAIN), more = wordSet(MORE), filler = wordSet(FILLER);

/** `again`: search once more for the earlier question. `more`: say more (or simpler, or shorter) about it. `undefined`: the message is a question of its own. */
export function followUpKind(message: string): "again" | "more" | undefined {
  const known = (word: string) => again.has(word) || more.has(word) || filler.has(word);
  // An attached "and" or "so" before a listed word is that word.
  const tokens = (normalizeSearch(message).match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => !known(word) && word.length > 2 && /^[وف]/u.test(word) && known(word.slice(1)) ? word.slice(1) : word);
  if (!tokens.length || tokens.length > FOLLOW_UP_MAX_WORDS || !tokens.every(known)) return undefined;
  return tokens.some((word) => more.has(word)) ? "more" : tokens.some((word) => again.has(word)) ? "again" : undefined;
}

export interface Carried {
  kind: "again" | "more";
  /** The earlier question: what the search runs on. */
  search: string;
  /** What the writer answers: the earlier question, with the follow-up after it when the reader asked for more. */
  question: string;
}
/** The earlier question a follow-up message is carried on: the latest question of the conversation that is not itself a follow-up.
 * `undefined` when the message is a question of its own; `"no_question"` when it is a follow-up and the conversation holds no question.
 * With no earlier question but an open stop, "explain" or "an example" is about what the reader has open, so it stays a question of its own; "search again" never is. */
export function carriedQuestion(message: string, history: unknown, openStop = false): Carried | "no_question" | undefined {
  const kind = followUpKind(message);
  if (!kind) return undefined;
  for (const item of Array.isArray(history) ? history.slice(-HISTORY_TURNS).reverse() : []) {
    const earlier = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>).question : undefined;
    if (typeof earlier !== "string" || !earlier.trim() || followUpKind(earlier)) continue;
    const search = [...earlier.trim()].slice(0, 300).join("");
    return { kind, search, question: kind === "again" ? search : `${search} ${message.trim()}` };
  }
  return kind === "more" && openStop ? undefined : "no_question";
}

/** The sentence ids the earlier turns cited, as far as they look like ids, before retrieval (so retrieval can keep them); `resolveHistory` checks them again against the final list. */
export function historyAtomIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value.slice(-HISTORY_TURNS)) {
    const list = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>).atom_ids : undefined;
    if (Array.isArray(list)) for (const id of list) if (typeof id === "string" && id.length <= 100 && !id.startsWith("src:")) ids.push(id);
  }
  return [...new Set(ids)].slice(0, 40);
}

/** The request's `history`, checked and clipped. It is context for reading references ("this", "clearer"), never a source, so anything malformed is skipped, never an error:
 * only the last two entries are looked at, each text is cut at 600 characters, and an atom id that is not a sentence of this surah is dropped. */
export function resolveHistory(value: unknown, atoms: readonly { id: string }[]): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(atoms.map((atom) => atom.id));
  const turns: HistoryTurn[] = [];
  for (const item of value.slice(-HISTORY_TURNS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const { question, answer, atom_ids } = item as Record<string, unknown>;
    if (typeof question !== "string" || !question.trim() || typeof answer !== "string") continue;
    const ids = Array.isArray(atom_ids) ? [...new Set(atom_ids.filter((id): id is string => typeof id === "string" && known.has(id)))].slice(0, HISTORY_ATOMS) : [];
    turns.push({ question: clip(question), answer: clip(answer), atom_ids: ids });
  }
  return turns;
}

const segmentText = (segments: Segment[]) => segments.map((segment) => segment.t === "text" || segment.t === "quote" || segment.t === "term" ? segment.v : "").join("");
const atomsText = (atoms: PublicAtom[]) => atoms.map((atom) => segmentText(atom.segments).trim()).filter(Boolean).join(" ");

/** What the reader sees of one finished turn, as plain text: the written sentences joined (their verified sentences when one was dropped), the example if any, or the verified sentences themselves when the answer was extractive. */
export function answerText(result: AskResponse): string {
  if (result.status !== "answer") return "";
  const view = composedView(result);
  if (!view) return atomsText(result.atoms);
  return view.map((item) => item.kind === "verbatim" ? atomsText(item.atoms) : item.text).filter(Boolean).join(" ");
}

/** The last two finished turns of the thread, in the shape the server expects. */
export function historyFromTurns(turns: readonly { question: string; loading: boolean; result: AskResponse | null }[]): HistoryTurn[] {
  // A follow-up turn ("search again") is sent under the question it followed, so the server still finds that question after several follow-ups.
  let earlier: string | undefined;
  return turns.filter((turn) => !turn.loading && turn.result).map((turn) => {
    if (!followUpKind(turn.question)) earlier = turn.question;
    return { question: earlier ?? turn.question, answer: answerText(turn.result!), atom_ids: turn.result!.atoms.map((atom) => atom.id) };
  }).slice(-HISTORY_TURNS);
}
