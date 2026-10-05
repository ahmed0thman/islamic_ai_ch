// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { embedQuery, vectorLiteral } from "./embed.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { getPool, loadSql, schemaName, withSchema } from "./db.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { fuse, tsQueryText } from "./query.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { DEFINITION_SOURCES } from "./scope.ts";
import type { Atom } from "../ask/types";

// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
export { fuse, tokenize, tsQueryText } from "./query.ts";

export interface RetrieveInput {
  question: string; surah: number; depth: 0 | 1 | 2 | 3; stop?: number; stopAyahs?: string[];
  openRecord?: string; historyAtomIds?: string[]; k?: number;
}
export interface Retrieved {
  atoms: Atom[];
  /** `fallback`: the database was not used and `atoms` are all the sentences of the open surah, as before. `dense` only when HUDA_RAG_MODE=dense. */
  mode: "hybrid" | "lexical" | "dense" | "fallback";
  ms: number;
  candidates: { lexical: number; dense: number };
}
export interface RetrievedPassage {
  id: string; source_id: string; source_title: string; author: string;
  /** Digits and separators only, e.g. `3/45` (part/page) or `45`. */
  locator: string; url: string | null; text: string; ayah_keys: string[]; score: number;
}
export interface RetrievedPassages { passages: RetrievedPassage[]; mode: "hybrid" | "lexical" | "dense" | "off"; ms: number }

const TOTAL_TIMEOUT_MS = 3000;
const ATOM_DEFAULT_K = 24, PASSAGE_DEFAULT_K = 8;

type RagMode = "hybrid" | "lexical" | "dense";
/** `HUDA_RAG_MODE=hybrid|lexical|dense` (default hybrid): which legs run, for evaluation. */
function ragMode(): RagMode {
  const value = process.env.HUDA_RAG_MODE;
  return value === "lexical" || value === "dense" ? value : "hybrid";
}

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
const clamp = (value: number | undefined, fallback: number, max: number) =>
  Number.isInteger(value) && value! >= 1 ? Math.min(value!, max) : fallback;
const AYAH_KEY = /^\d{1,3}:\d{1,3}$/;

/** Which legs run: lexical needs content words, dense needs a vector. Dense-only evaluation without a vector degrades to lexical (and says so). */
async function legs(question: string, mode: RagMode) {
  const words = tsQueryText(question);
  const vector = mode === "lexical" ? null : await embedQuery(question);
  const lexical = words !== "" && (mode !== "dense" || !vector);
  const dense = vector !== null;
  const used: "hybrid" | "lexical" | "dense" = lexical && dense ? "hybrid" : dense ? "dense" : "lexical";
  return { tsquery: lexical ? words : "", vector: dense ? vectorLiteral(vector!) : null, mode: used };
}

export interface AtomRow { atom: Atom; group: number; score: number | null; lex_rank: number | null; dense_rank: number | null }
/** The statement of app/db/search_atoms.sql with its raw rows (the test compares the fusion scores). */
export async function searchAtoms(input: RetrieveInput): Promise<{ rows: AtomRow[]; mode: Retrieved["mode"]; candidates: Retrieved["candidates"] }> {
  const pool = getPool();
  if (!pool) throw new Error("no database");
  const { tsquery, vector, mode } = await legs(input.question, ragMode());
  const history = (input.historyAtomIds ?? []).filter((id) => typeof id === "string" && id.length <= 100).slice(0, 40);
  const openRecord = typeof input.openRecord === "string" && input.openRecord.length <= 60 ? input.openRecord : null;
  const stop = Number.isInteger(input.stop) && input.stop! >= 1 ? input.stop! : null;
  const sql = withSchema(loadSql("search_atoms.sql"), schemaName());
  const result = await pool.query(sql, [tsquery, vector, input.surah, openRecord, clamp(input.k, ATOM_DEFAULT_K, 60), input.depth, stop, history]);
  const rows: AtomRow[] = result.rows.map((row) => ({
    atom: {
      id: row.id, level: row.level, role: row.role === "definition" ? "claim" : row.role, segments: row.segments,
      records: row.records, text: row.text, locations: row.locations,
    } as Atom,
    group: row.grp, score: row.score, lex_rank: row.lex_rank, dense_rank: row.dense_rank,
  }));
  return { rows, mode, candidates: { lexical: result.rows[0]?.n_lex ?? 0, dense: result.rows[0]?.n_dense ?? 0 } };
}

/**
 * The sentences the Ask assistant may choose from: hybrid retrieval (lexical + dense, fused by rank) over the verified sentences of every published surah,
 * plus every sentence of the open stop, the sentences cited in earlier turns and the definitions of the terms they carry.
 * On any error, a timeout (3 s) or a missing `DATABASE_URL` it returns `loadSurahAtoms(surah)` with `mode: "fallback"`. It does not throw because of the database.
 */
export async function retrieveAtoms(input: RetrieveInput, loadSurahAtoms: (surah: number) => Promise<Atom[]>): Promise<Retrieved> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const { rows, mode, candidates } = await within(searchAtoms(input), TOTAL_TIMEOUT_MS);
    return { atoms: rows.map((row) => row.atom), mode, ms: elapsed(), candidates };
  } catch {
    const atoms = await loadSurahAtoms(input.surah);
    return { atoms, mode: "fallback", ms: elapsed(), candidates: { lexical: 0, dense: 0 } };
  }
}

/** Short human-readable place in the book, from numbers only. */
export function passageLocator(row: { part: string | null; printed_page: string | null; page_id: number | null }): string {
  const page = row.printed_page ?? (row.page_id !== null ? String(row.page_id) : "");
  return row.part && page ? `${row.part}/${page}` : page || row.part || "";
}

/**
 * Book passages that may be woven into an answer: those linked to an ayah of the open surah (boosted when linked to the open stop's ayahs),
 * plus dictionary and definition sources found by words. Same hybrid recipe as the atoms. On any error returns `{ passages: [], mode: "off" }`.
 */
export async function retrievePassages(input: { question: string; surah: number; stopAyahs?: string[]; k?: number }): Promise<RetrievedPassages> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const pool = getPool();
    if (!pool) throw new Error("no database");
    return await within((async (): Promise<RetrievedPassages> => {
      const { tsquery, vector, mode } = await legs(input.question, ragMode());
      const ayahs = (input.stopAyahs ?? []).filter((key) => typeof key === "string" && AYAH_KEY.test(key)).slice(0, 60);
      const sql = withSchema(loadSql("search_passages.sql"), schemaName());
      const result = await pool.query(sql, [tsquery, vector, input.surah, ayahs.length ? ayahs : null, clamp(input.k, PASSAGE_DEFAULT_K, 30), [...DEFINITION_SOURCES]]);
      const passages: RetrievedPassage[] = result.rows.map((row) => ({
        id: row.id, source_id: row.source_id, source_title: row.source_title, author: row.author,
        locator: passageLocator(row), url: row.url ?? null, text: row.text, ayah_keys: row.ayah_keys, score: row.score,
      }));
      return { passages, mode, ms: elapsed() };
    })(), TOTAL_TIMEOUT_MS);
  } catch {
    return { passages: [], mode: "off", ms: elapsed() };
  }
}
