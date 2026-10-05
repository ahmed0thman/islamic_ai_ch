import type { Ayah, ParagraphBlock, Segment, SourceRecord, Surah } from "./types";
import type { AskExtra, HistoryTurn, PublicAtom } from "./ask/types";
// @ts-expect-error -- Node tests require explicit source extensions.
import { ownKeyHeaders } from "./own-key.ts";

export function requestAsk(body: { surah: number; question: string; depth: number; stop?: number; history?: HistoryTurn[]; open_record?: string }, signal?: AbortSignal, send: typeof fetch = fetch): Promise<Response> {
  return send("/api/ask/", {
    method: "POST", signal, cache: "no-store", headers: { "Content-Type": "application/json", ...ownKeyHeaders() },
    body: JSON.stringify(body),
  });
}

/** A book excerpt has no record of ours: this stands in for one so the marker and the sheet can show where it came from. Its id is the atom's id. */
export function sourceRecordOf(atom: PublicAtom): SourceRecord | undefined {
  if (atom.role !== "source" || !atom.source) return undefined;
  const text = atom.segments.map((segment) => segment.t === "text" ? segment.v : "").join("");
  return {
    id: atom.id, icons: [], badge: null, state: "source_direct", claim: text, status_text: "", depth_min: atom.level, ayah_keys: [],
    evidence: [{ icon: "scholar", source_title: atom.source.title, author: atom.source.author, locator: atom.source.locator, quote: text, url: atom.source.url, rulings: [], link_strength: null }],
  };
}

/** The segments a sentence is drawn with: a book excerpt ends with a marker that opens its (stand-in) record. */
export function displaySegments(atom: PublicAtom): Segment[] {
  return atom.role === "source" ? [...atom.segments, { t: "mark", records: [atom.id] }] : atom.segments;
}
export const blockRole = (atom: PublicAtom): ParagraphBlock["role"] => atom.role === "source" ? "claim" : atom.role;

/** The records and ayahs a set of answer atoms needs: those of the open surah, those the server sent for other surahs, and a stand-in record for each book excerpt. */
export function drawingFor(reading: { records: Surah["records"]; ayahs: ReadonlyMap<string, Ayah> }, atoms: readonly PublicAtom[], extra?: AskExtra, held?: { records?: Record<string, SourceRecord>; ayahs?: Ayah[] }) {
  const records: Record<string, SourceRecord> = { ...reading.records, ...(held?.records ?? {}), ...(extra?.records ?? {}) };
  for (const atom of atoms) { const record = sourceRecordOf(atom); if (record) records[record.id] = record; }
  const ayahs = new Map<string, Ayah>(reading.ayahs);
  for (const ayah of [...(held?.ayahs ?? []), ...(extra?.ayahs ?? [])]) ayahs.set(ayah.key, ayah);
  return { records, ayahs };
}
