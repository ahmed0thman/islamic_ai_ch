// @ts-expect-error -- Node requires source extensions.
import { composedView } from "../ask-composed-view.ts";
import type { Segment } from "../types";
import type { AskResponse, HistoryTurn, PublicAtom } from "./types";

export const HISTORY_TURNS = 2;
export const HISTORY_TEXT_CHARS = 600;
const HISTORY_ATOMS = 8;
const clip = (text: string) => [...text.trim()].slice(0, HISTORY_TEXT_CHARS).join("");

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
  return turns.filter((turn) => !turn.loading && turn.result).slice(-HISTORY_TURNS)
    .map((turn) => ({ question: turn.question, answer: answerText(turn.result!), atom_ids: turn.result!.atoms.map((atom) => atom.id) }));
}
