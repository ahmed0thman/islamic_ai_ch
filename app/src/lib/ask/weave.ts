// @ts-expect-error -- Node tests require explicit source extensions.
import { deriveAtoms, readerUnits, resolveReaderContext, suspendedNarration } from "./atoms.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { answer } from "./answer.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { questionWithinLimit } from "./runtime.ts";
import type { Depth } from "../types";
import type { AnswerOptions } from "./answer";
import type { AskResponse, AtomSource, ChoiceProvider, HistoryTurn } from "./types";

export interface WeaveRequest { surah: number; depth: Depth; stop: number; questions: string[] }
export function parseWeaveRequest(value: unknown): WeaveRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { surah, depth, stop, questions } = value as Record<string, unknown>;
  if (typeof surah !== "number" || !Number.isInteger(surah)
    || (depth !== 0 && depth !== 1 && depth !== 2 && depth !== 3)
    || typeof stop !== "number" || !Number.isInteger(stop) || stop < 1
    || !Array.isArray(questions) || questions.length > 5 || questions.some((item) => typeof item !== "string")) return;
  const trimmed = (questions as string[]).map((item) => item.trim()).filter(Boolean);
  if (!trimmed.length || trimmed.some((item) => !questionWithinLimit(item))) return;
  return { surah, depth, stop, questions: trimmed };
}

/** Location membership follows select.ts and includes deduplicated sentences and term definitions.
 * Shared record ids alone do not admit sentences from another stop or depth. */
export function stopAtoms(source: AtomSource, depth: Depth, stop: number) {
  const unit = readerUnits(source, depth).find((item) => item.number === stop);
  if (!unit) return [];
  const records = new Set(unit.recordIds);
  return deriveAtoms(source).filter((atom) => atom.role !== "source"
    && atom.locations?.some((location) => location.depth === depth && location.stops.includes(unit.number))
    && atom.records.every((id) => records.has(id)));
}

/** Count surviving, cited prose only. Dropped sentences and examples never replace the original. */
export function weaveResult(result: AskResponse): AskResponse {
  const unavailable: AskResponse = { status: "unavailable", atoms: [] };
  if (result.status !== "answer" || result.mode !== "composed") return unavailable;
  const composed = result.composed?.filter((item) => item.kind !== "example" && item.text?.trim() && item.atom_ids.length);
  if (!composed || composed.length < 2) return unavailable;
  const used = new Set(composed.flatMap((item) => item.kind === "example" ? [] : item.atom_ids));
  return { status: "answer", mode: "composed", composed, atoms: result.atoms.filter((atom) => used.has(atom.id)) };
}

export async function weaveStop(source: AtomSource, request: WeaveRequest, instruction: string, providers: ChoiceProvider[], options: Pick<AnswerOptions, "log" | "observe"> = {}): Promise<AskResponse> {
  const atoms = stopAtoms(source, request.depth, request.stop).map((atom) => suspendedNarration(atom, source.records) ? { ...atom, suspended: true } : atom);
  if (!atoms.length || !instruction?.trim()) return { status: "unavailable", atoms: [] };
  const context = resolveReaderContext(source, request.depth, request.stop);
  const history: HistoryTurn[] = request.questions.map((question) => ({ question, answer: "", atom_ids: [] }));
  return weaveResult(await answer(instruction, atoms, {
    ...context!, surah: source.surah.no, ayah_numbers: source.ayahs.map((ayah) => Number(ayah.key.split(":")[1])),
  }, providers, { ...options, mode: "composed", extractiveFallback: false, history }));
}
