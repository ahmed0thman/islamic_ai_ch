// @ts-expect-error -- Node requires source extensions.
import { tokenize } from "../rag/query.ts";
// @ts-expect-error -- Node requires source extensions.
import { CHAIN_MARKERS, REPORT_MARKERS, REPORT_SOURCES, guardTokens, hasMarker } from "./source-guard.ts";
import type { Depth } from "../types";
import type { Atom } from "./types";
import type { RetrievedPassage } from "../rag/retrieve";

export interface SourceDropped { report_source: number; chain: number; report_unit: number; short: number }
export const MAX_PASSAGES = 6, MAX_UNITS_PER_PASSAGE = 10, MAX_UNITS = 48;
const MIN_WORDS = 4, SPLIT_AT_WORDS = 45, DISCARD_OVER_WORDS = 60;
// Sentence ends: full stop, exclamation, Arabic question mark (code point 0x61F), Arabic semicolon (0x61B), and line breaks. The comma is 0x60C.
const END = new RegExp("[.!" + String.fromCodePoint(0x61f, 0x61b) + "]|" + String.fromCharCode(10), "u");
const COMMA = String.fromCodePoint(0x60c);

const wordCount = (text: string) => text.split(/\s+/u).filter(Boolean).length;

/** Sentence-sized spans of a passage as [start, end) offsets: each ends after its terminator (or at a newline). */
function sentenceSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!END.test(text[i])) continue;
    spans.push([start, text[i] === "\n" ? i : i + 1]);
    start = i + 1;
  }
  if (start < text.length) spans.push([start, text.length]);
  return spans;
}

/** Splits a span at the comma nearest its middle, again and again, until every part has at most 45 words. */
function splitLong(text: string, start: number, end: number): [number, number][] {
  const piece = text.slice(start, end);
  if (wordCount(piece) <= SPLIT_AT_WORDS) return [[start, end]];
  const commas: number[] = [];
  for (let i = 0; i < piece.length; i++) if (piece[i] === COMMA && i + 1 < piece.length) commas.push(i + 1);
  if (!commas.length) return [[start, end]];
  const middle = piece.length / 2;
  const cut = commas.reduce((best, at) => Math.abs(at - middle) < Math.abs(best - middle) ? at : best);
  return [...splitLong(text, start, start + cut), ...splitLong(text, start + cut, end)];
}

interface Unit { index: number; text: string; skip: boolean }
/** Every unit of one passage, in order, with its stable index. A unit that is dropped for length stays in the list so that "the unit after a narration formula" keeps its meaning. */
function cutUnits(text: string): Unit[] {
  const units: Unit[] = [];
  for (const [from, to] of sentenceSpans(text)) {
    for (const [start, end] of splitLong(text, from, to)) {
      const raw = text.slice(start, end);
      const lead = raw.length - raw.trimStart().length;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      units.push({ index: units.length, text: text.slice(start + lead, start + lead + trimmed.length), skip: wordCount(trimmed) > DISCARD_OVER_WORDS });
    }
  }
  return units;
}

/**
 * Book passages become source atoms: verbatim sentence-sized cuts made by the server, cited by the model exactly as verified atoms are.
 * Passages of narration collections, passages with a transmission chain, units that report a narration (and the unit after), and tiny units are dropped.
 */
export function sourceAtoms(passages: readonly RetrievedPassage[], question: string, depth: Depth, surah?: number): { atoms: Atom[]; dropped: SourceDropped } {
  const dropped: SourceDropped = { report_source: 0, chain: 0, report_unit: 0, short: 0 };
  const wanted = new Set(tokenize(question));
  const light = (word: string) => word.startsWith(String.fromCodePoint(0x627, 0x644)) && word.length > 4 ? word.slice(2) : word;
  const atoms: Atom[] = [];
  let passagesKept = 0;
  for (const passage of passages) {
    if (passagesKept >= MAX_PASSAGES || atoms.length >= MAX_UNITS) break;
    if (REPORT_SOURCES.has(passage.source_id)) { dropped.report_source++; continue; }
    if (hasMarker(guardTokens(passage.text), CHAIN_MARKERS)) { dropped.chain++; continue; }
    const units = cutUnits(passage.text);
    const tokens = units.map((unit) => guardTokens(unit.text));
    const reports = units.map((_, i) => hasMarker(tokens[i], REPORT_MARKERS));
    const kept: (Unit & { score: number })[] = [];
    for (const unit of units) {
      if (reports[unit.index] || (unit.index > 0 && reports[unit.index - 1])) { dropped.report_unit++; continue; }
      if (unit.skip) continue;
      if (wordCount(unit.text) < MIN_WORDS) { dropped.short++; continue; }
      const own = new Set(tokens[unit.index].flatMap((word) => [word, light(word)]));
      kept.push({ ...unit, score: [...wanted].filter((word) => own.has(word) || own.has(light(word))).length });
    }
    if (!kept.length) continue;
    const room = Math.min(MAX_UNITS_PER_PASSAGE, MAX_UNITS - atoms.length);
    const chosen = [...kept].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, room).sort((a, b) => a.index - b.index);
    passagesKept++;
    for (const unit of chosen) {
      atoms.push({
        id: `src:${passage.id}:${unit.index}`, level: depth, role: "source", records: [], text: unit.text,
        segments: [{ t: "text", v: unit.text }],
        source: { source_id: passage.source_id, title: passage.source_title, author: passage.author, locator: passage.locator, url: passage.url },
        ...(surah !== undefined ? { surah } : {}),
      });
    }
  }
  return { atoms, dropped };
}
