import type { Ayah, Depth, Segment, SourceRecord, Surah, Ui } from "../types";

export type ChoiceStatus = "answer" | "insufficient" | "fatwa" | "out_of_scope" | "not_arabic";
export interface Choice { status: ChoiceStatus; atom_ids: string[] }
/** Where an excerpt of a book comes from; filled only for `role: "source"` atoms. */
export interface SourceInfo { source_id: string; title: string; author: string; locator: string; url: string | null }
export interface PublicAtom {
  /** `source`: a sentence-sized cut of a book passage, made by the server (`src:<passage>:<unit>`), never reviewed. */
  id: string; level: Depth; role: "claim" | "transmission" | "source";
  segments: Segment[]; records: string[];
  /** The surah the sentence belongs to (for a source atom, the open surah). */
  surah?: number;
  source?: SourceInfo;
}
export interface Atom extends PublicAtom {
  text: string;
  /** All source locations, including duplicates retained under the original lowest-depth ID. */
  locations?: { depth: Depth; stops: number[] }[];
  /** A narration whose record carries no accepted ruling (decision 058): shown word for word with its marker, never reworded or built on. Server only. */
  suspended?: boolean;
}
export interface ReaderContext {
  depth: Depth;
  stop?: number;
  stop_title?: string;
  surah?: number;
  ayah_numbers?: number[];
  stop_ayahs?: { key: string; text: string }[];
}
/** `kind` absent or "claim": a sentence that rests on cited verified sentences. "example": an illustration of a language point, with no cites. */
export interface ComposedSentence { text: string; cites: string[]; kind?: "claim" | "example" }
export interface Composition { status: ChoiceStatus; sentences: ComposedSentence[] }
/** `text` present: a written sentence that passed every check. Absent: the written sentence was dropped and the UI shows its cited verified sentences verbatim.
 * `kind: "example"`: an everyday illustration written by the model; it cites nothing and is never saved with the reader's questions. */
export type ComposedItem = { kind?: undefined; text?: string; atom_ids: string[] } | { kind: "example"; text: string };
/** One earlier turn of the open conversation, already validated and clipped; context for references only, never a source. */
export interface HistoryTurn { question: string; answer: string; atom_ids: string[] }
/** What the client needs to draw verified sentences of surahs other than the open one: their records and the ayahs they show. */
export interface AskExtra { records: Record<string, SourceRecord>; ayahs: Ayah[] }
/** `sources`: the server weaves from book passages (so the note under the composer says so). */
/** `no_question`: the message only follows up on an earlier question ("search again", "explain more") and the conversation holds none. */
export interface AskResponse { status: ChoiceStatus | "unavailable" | "no_question"; mode?: "composed" | "extractive"; composed?: ComposedItem[]; atoms: PublicAtom[]; sources?: boolean; extra?: AskExtra }
/** One illustration for the writer: a verified sentence and the quote of its first record. Never material, never citable. */
export interface ExamplePair { source_quote: string; verified_sentence: string }
export type AskUi = Ui & { ask: Record<"title" | "placeholder" | "submit" | "loading" | "answer_title" | "note" | "unavailable", string> };
export interface SelectionRequest { system: string; message: string; signal: AbortSignal; schema?: Record<string, unknown>; stage?: "select" | "compose" | "support" | "repair" }
export interface ChoiceProvider { name?: string; choose(request: SelectionRequest): Promise<unknown> }
export type AtomSource = Surah;
