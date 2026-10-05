import type { Depth, Segment, Surah, Ui } from "../types";

export type ChoiceStatus = "answer" | "insufficient" | "fatwa" | "out_of_scope" | "not_arabic";
export interface Choice { status: ChoiceStatus; atom_ids: string[] }
export interface PublicAtom {
  id: string; level: Depth; role: "claim" | "transmission";
  segments: Segment[]; records: string[];
}
export interface Atom extends PublicAtom {
  text: string;
  /** All source locations, including duplicates retained under the original lowest-depth ID. */
  locations?: { depth: Depth; stops: number[] }[];
}
export interface ReaderContext {
  depth: Depth;
  stop?: number;
  stop_title?: string;
  surah?: number;
  ayah_numbers?: number[];
  stop_ayahs?: { key: string; text: string }[];
}
export interface ComposedSentence { text: string; cites: string[] }
export interface Composition { status: ChoiceStatus; sentences: ComposedSentence[] }
/** `text` present: a written sentence that passed every check. Absent: the written sentence was dropped and the UI shows its cited verified sentences verbatim. */
export interface ComposedItem { text?: string; atom_ids: string[] }
export interface AskResponse { status: ChoiceStatus | "unavailable"; mode?: "composed" | "extractive"; composed?: ComposedItem[]; atoms: PublicAtom[] }
export type AskUi = Ui & { ask: Record<"title" | "placeholder" | "submit" | "loading" | "answer_title" | "note" | "unavailable", string> };
export interface SelectionRequest { system: string; message: string; signal: AbortSignal; schema?: Record<string, unknown>; stage?: "select" | "compose" | "support" }
export interface ChoiceProvider { name?: string; choose(request: SelectionRequest): Promise<unknown> }
export type AtomSource = Surah;
