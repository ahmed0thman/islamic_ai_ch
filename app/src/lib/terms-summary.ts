import type { Block, Segment, SourceRecord } from "./types";

export interface SummaryTerm { text: string; record: SourceRecord }
/** `science` is the key in `ui.sciences`; null groups the terms whose record names no known science. */
export interface TermGroup { science: string | null; terms: SummaryTerm[] }
export interface TermsSummary { termCount: number; scienceCount: number; groups: TermGroup[] }

function termSegments(block: Block): Extract<Segment, { t: "term" }>[] {
  const segments = block.type === "paragraph" ? block.segments
    : block.type === "details" ? [...block.title, ...block.blocks.flatMap((inner) => inner.segments)] : [];
  return segments.filter((segment): segment is Extract<Segment, { t: "term" }> => segment.t === "term");
}
/** The record's science when the dictionary names it. A missing field or an unknown key counts as no science, as the term panel does. */
export function scienceOf(record: SourceRecord, sciences: Record<string, string> | undefined): string | null {
  return record.science && sciences && Object.hasOwn(sciences, record.science) ? record.science : null;
}

/**
 * What the reader met in the level shown: its `term` segments and their records, nothing from the reader's own history.
 * Each record counts once, under the text it was first met with. Groups follow the order the sciences are first met in;
 * the terms without a science come last. Returns null when the level has no terms.
 */
export function deriveTermsSummary(blocks: readonly Block[], records: Record<string, SourceRecord>, sciences?: Record<string, string>): TermsSummary | null {
  const seen = new Set<string>();
  const groups: TermGroup[] = [];
  for (const block of blocks) for (const segment of termSegments(block)) {
    const record = records[segment.record];
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    const science = scienceOf(record, sciences);
    let group = groups.find((item) => item.science === science);
    if (!group) { group = { science, terms: [] }; groups.push(group); }
    // The approved name of the term when its record carries one; otherwise the wording of the text.
    group.terms.push({ text: record.term || segment.v, record });
  }
  if (!seen.size) return null;
  groups.sort((a, b) => Number(a.science === null) - Number(b.science === null));
  return { termCount: seen.size, scienceCount: groups.filter((group) => group.science !== null).length, groups };
}
