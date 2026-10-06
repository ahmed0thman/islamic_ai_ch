// @ts-expect-error -- Node requires source extensions.
import { retrieveAtoms, retrievePassages } from "../rag/retrieve.ts";
// @ts-expect-error -- Node requires source extensions.
import { deriveAtoms, suspendedNarration } from "./atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { sourceAtoms } from "./source-atoms.ts";
// @ts-expect-error -- Node requires source extensions.
import { surahOf } from "./public-atom.ts";
import type { Ayah, Depth, SourceRecord, Surah } from "../types";
import type { StageEvent } from "./runtime";
import type { SourceDropped } from "./source-atoms";
import type { AskExtra, Atom, ExamplePair, PublicAtom } from "./types";

export interface GatherInput {
  question: string; surah: number; depth: Depth; stop?: number; stopAyahs?: string[]; openRecord?: string; historyAtomIds?: string[];
  /** The reader asked to search again: more sentences and passages are brought than the first time. */
  wide?: boolean;
}
export interface Gathered {
  /** Verified atoms first, then source atoms. */
  atoms: Atom[];
  examples: ExamplePair[];
  /** The `retrieve` stage event, for the request's log line. */
  event: StageEvent;
  dropped: SourceDropped;
  /** Whether this request weaves from book passages (the database answered and book weaving is on). */
  sources: boolean;
}
const NONE: SourceDropped = { report_source: 0, chain: 0, report_unit: 0, short: 0 };
const MAX_EXAMPLE_CHARS = 500;
/** How many ranked sentences a second search brings (the first brings 24). */
export const WIDE_K = 40;

/** `HUDA_ASK_SOURCES=0` turns book weaving off; otherwise it is on whenever `DATABASE_URL` is set. */
export const sourcesEnabled = (env: Record<string, string | undefined> = process.env) => env.HUDA_ASK_SOURCES !== "0" && Boolean(env.DATABASE_URL);

/** Up to three pairs of (the verified sentence, the quote of its first record's first evidence), taken from the best-ranked retrieved sentences that have one. */
async function pickExamples(retrieved: { atoms: Atom[]; top: string[] }, loadSurah: (surah: number) => Promise<Surah>): Promise<ExamplePair[]> {
  const byId = new Map(retrieved.atoms.map((atom) => [atom.id, atom]));
  const pairs: ExamplePair[] = [];
  for (const id of retrieved.top) {
    if (pairs.length === 3) break;
    const atom = byId.get(id);
    const surahNo = atom ? surahOf(atom) : undefined;
    if (!atom || atom.role === "source" || surahNo === undefined || !atom.records.length) continue;
    try {
      const quote = (await loadSurah(surahNo)).records[atom.records[0]]?.evidence.find((item) => typeof item.quote === "string" && item.quote.trim())?.quote;
      if (quote && quote.length <= MAX_EXAMPLE_CHARS) pairs.push({ source_quote: quote, verified_sentence: atom.text });
    } catch { /* No example is better than a failed request. */ }
  }
  return pairs;
}

/** Marks the narrations that may not be built on (decision 058), from the records of the surah each belongs to. A narration whose records cannot be read is marked too. */
export async function markSuspended(atoms: Atom[], loadSurah: (surah: number) => Promise<Surah>): Promise<Atom[]> {
  return Promise.all(atoms.map(async (atom) => {
    if (atom.role !== "transmission") return atom;
    const surahNo = surahOf(atom);
    let suspended = true;
    try { if (surahNo !== undefined) suspended = suspendedNarration(atom, (await loadSurah(surahNo)).records); } catch { /* Fails closed. */ }
    return suspended ? { ...atom, suspended: true } : atom;
  }));
}

/**
 * What the writer may use for one question: verified sentences (retrieved, or all of the open surah when the database is not used) and, when the
 * database answered, source atoms cut from the retrieved book passages. It never throws because of the database.
 */
export async function gatherAtoms(input: GatherInput, loadSurah: (surah: number) => Promise<Surah>, env: Record<string, string | undefined> = process.env): Promise<Gathered> {
  const wantSources = sourcesEnabled(env);
  const [retrieved, passages] = await Promise.all([
    retrieveAtoms({ ...input, k: input.wide ? WIDE_K : 24 }, async (surah: number) => deriveAtoms(await loadSurah(surah))),
    wantSources ? retrievePassages({ question: input.question, surah: input.surah, stopAyahs: input.stopAyahs, k: input.wide ? 12 : 8 }) : Promise.resolve({ passages: [], mode: "off" as const, ms: 0 }),
  ]);
  // In fallback the behaviour is exactly the one without a database: every sentence of the open surah, nothing from books.
  const fallback = retrieved.mode === "fallback";
  const woven = !fallback && wantSources ? sourceAtoms(passages.passages, input.question, input.depth, input.surah) : { atoms: [] as Atom[], dropped: NONE };
  const atoms = [...await markSuspended(retrieved.atoms, loadSurah), ...woven.atoms];
  const examples = fallback ? [] : await pickExamples(retrieved, loadSurah);
  return {
    atoms, examples, dropped: woven.dropped, sources: !fallback && wantSources,
    event: { stage: "retrieve", provider: retrieved.mode, outcome: `${retrieved.atoms.length}/${passages.passages.length}/${woven.atoms.length}`, ms: retrieved.ms },
  };
}

/** What the client needs to draw cited verified sentences of other surahs than the open one: their records and ayahs. `undefined` when there are none. */
export async function extraFor(atoms: readonly PublicAtom[], openSurah: number, loadSurah: (surah: number) => Promise<Surah>): Promise<AskExtra | undefined> {
  const records: Record<string, SourceRecord> = {};
  const ayahs = new Map<string, Ayah>();
  for (const atom of atoms) {
    const surahNo = atom.role === "source" ? undefined : atom.surah;
    if (surahNo === undefined || surahNo === openSurah) continue;
    try {
      const surah = await loadSurah(surahNo);
      const ids = new Set(atom.records);
      for (const segment of atom.segments) {
        if ((segment.t === "term" || segment.t === "quote") && segment.record) ids.add(segment.record);
        if (segment.t === "ayah") { const ayah = surah.ayahs.find((item) => item.key === segment.key); if (ayah) ayahs.set(ayah.key, ayah); }
      }
      for (const id of ids) if (surah.records[id]) records[id] = surah.records[id];
    } catch { /* The sentence is then drawn without those records. */ }
  }
  return Object.keys(records).length || ayahs.size ? { records, ayahs: [...ayahs.values()] } : undefined;
}
