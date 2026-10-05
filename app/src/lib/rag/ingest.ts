import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type pg from "pg";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { deriveAtoms } from "../ask/atoms.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { normalizeSearch as normalize } from "../ask/normalize.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { embedEnabled, embedPassages, vectorLiteral } from "./embed.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { loadSql, withSchema } from "./db.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { DEFINITION_SOURCES, EMBED_MODEL_TAG, PASSAGE_SURAH_MAX, PASSAGE_SURAH_MIN } from "./scope.ts";
import type { Surah } from "../types";

/** Ingest of the verified sentences, the records behind them and the book passages into Postgres. Used by app/scripts/rag-ingest.mts and the tests. */

export const repoRoot = () => process.env.HUDA_REPO_ROOT || path.resolve(process.cwd(), "..");
// The private record file's display decision when the file is missing: written from code points (the code holds no Arabic characters). It is the word "yes".
const DISPLAY_YES = String.fromCodePoint(0x646, 0x639, 0x645);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const q = (schema: string, sql: string) => withSchema(sql, schema);

export async function applySchema(pool: pg.Pool, schema: string): Promise<void> {
  await pool.query(withSchema(loadSql("rag.sql"), schema));
}

interface PublicEvidence { icon?: string; source_title?: string; author?: string; locator?: string; quote?: string; url?: string | null; rulings?: unknown[] }
interface PrivateRecord {
  id: string; display?: { decision?: string }; build_permission?: { decision?: string }; review_status?: string;
  evidence?: { ord?: number; source_id?: string; quote?: string }[];
}
export interface SurahIngest { surah: number; atoms: number; records: number; evidence: number; embedded: number; privateFile: boolean; unmatchedPrivate: number; sourceIdMissing: number }

function sourceIdsFor(record: { evidence?: PublicEvidence[] }, privateRecord: PrivateRecord | undefined): (string | null)[] {
  const own = record.evidence ?? [];
  const priv = [...(privateRecord?.evidence ?? [])].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
  if (priv.length === own.length) return priv.map((item) => item.source_id ?? null);
  return own.map((item) => priv.find((candidate) => candidate.quote !== undefined && candidate.quote === item.quote)?.source_id ?? null);
}

/** One published surah: records, evidence and atoms in one transaction (atoms and records no longer in the export are removed), then embeddings. */
export async function ingestSurah(pool: pg.Pool, schema: string, surahNo: number, options: { embed: boolean; batch?: number } = { embed: false }): Promise<SurahIngest> {
  const file = path.join(process.cwd(), "src/content", `surah-${surahNo}.json`);
  const raw = readFileSync(file);
  const version = sha256(raw);
  const surah = JSON.parse(raw.toString("utf8")) as Surah;
  if (surah.surah.no !== surahNo) throw new Error(`surah file ${surahNo} holds another surah`);
  const privatePath = path.join(repoRoot(), ".cache/records", String(surahNo), "records.v2.json");
  const privateFile = existsSync(privatePath);
  const privateRecords = new Map<string, PrivateRecord>();
  if (privateFile) for (const record of (JSON.parse(readFileSync(privatePath, "utf8")) as { records: PrivateRecord[] }).records) privateRecords.set(record.id, record);

  const records = Object.values(surah.records);
  let unmatchedPrivate = 0, sourceIdMissing = 0;
  const recordRows = records.map((record) => {
    const priv = privateRecords.get(record.id);
    if (privateFile && !priv) unmatchedPrivate++;
    return {
      id: record.id, surah_no: surahNo, claim: record.claim, badge: record.badge ?? null, state: record.state ?? null,
      status_text: record.status_text ?? "", depth_min: record.depth_min, ayah_keys: record.ayah_keys, science: record.science ?? null, icons: record.icons,
      display_decision: priv?.display?.decision ?? DISPLAY_YES, build_decision: priv?.build_permission?.decision ?? null,
      review_status: priv?.review_status ?? null, content_version: version,
    };
  });
  const evidenceRows = records.flatMap((record) => {
    const ids = sourceIdsFor(record, privateRecords.get(record.id));
    return record.evidence.map((item, ord) => {
      if (!ids[ord]) sourceIdMissing++;
      return { record_id: record.id, ord, icon: item.icon ?? null, source_id: ids[ord] ?? null, source_title: item.source_title ?? null, author: item.author ?? null,
        locator: item.locator ?? null, quote: item.quote ?? null, url: item.url ?? null, rulings: item.rulings ?? [] };
    });
  });
  const atoms = (deriveAtoms(surah) as ReturnType<typeof deriveAtoms>).map((atom: any, seq: number) => {
    const ayahKeys = [...new Set(atom.records.flatMap((id: string) => surah.records[id]?.ayah_keys ?? []))];
    const stops = [...new Set((atom.locations ?? []).flatMap((location: { stops: number[] }) => location.stops))].sort((a: any, b: any) => a - b);
    return {
      id: atom.id, surah_no: surahNo, depth: atom.level, role: atom.id.includes(":term:") ? "definition" : atom.role, text: atom.text, text_norm: normalize(atom.text),
      segments: atom.segments, records: atom.records, stops, ayah_keys: ayahKeys, locations: atom.locations ?? [], seq, published: true, content_version: version,
    };
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(q(schema, `
      INSERT INTO rag.records (id, surah_no, claim, badge, state, status_text, depth_min, ayah_keys, science, icons, display_decision, build_decision, review_status, content_version)
      SELECT x.id, x.surah_no, x.claim, x.badge, x.state, x.status_text, x.depth_min, x.ayah_keys, x.science, x.icons, x.display_decision, x.build_decision, x.review_status, x.content_version
      FROM jsonb_to_recordset($1::jsonb) AS x(id text, surah_no int, claim text, badge text, state text, status_text text, depth_min int, ayah_keys text[], science text, icons text[],
                                              display_decision text, build_decision text, review_status text, content_version text)
      ON CONFLICT (id) DO UPDATE SET surah_no = EXCLUDED.surah_no, claim = EXCLUDED.claim, badge = EXCLUDED.badge, state = EXCLUDED.state, status_text = EXCLUDED.status_text,
        depth_min = EXCLUDED.depth_min, ayah_keys = EXCLUDED.ayah_keys, science = EXCLUDED.science, icons = EXCLUDED.icons, display_decision = EXCLUDED.display_decision,
        build_decision = EXCLUDED.build_decision, review_status = EXCLUDED.review_status, content_version = EXCLUDED.content_version`), [JSON.stringify(recordRows)]);
    await client.query(q(schema, "DELETE FROM rag.records WHERE surah_no = $1 AND NOT (id = ANY ($2::text[]))"), [surahNo, recordRows.map((row) => row.id)]);
    await client.query(q(schema, "DELETE FROM rag.evidence WHERE record_id = ANY ($1::text[])"), [recordRows.map((row) => row.id)]);
    await client.query(q(schema, `
      INSERT INTO rag.evidence (record_id, ord, icon, source_id, source_title, author, locator, quote, url, rulings)
      SELECT x.record_id, x.ord, x.icon, x.source_id, x.source_title, x.author, x.locator, x.quote, x.url, x.rulings
      FROM jsonb_to_recordset($1::jsonb) AS x(record_id text, ord int, icon text, source_id text, source_title text, author text, locator text, quote text, url text, rulings jsonb)`),
      [JSON.stringify(evidenceRows)]);
    await client.query(q(schema, `
      INSERT INTO rag.atoms (id, surah_no, depth, role, text, text_norm, segments, records, stops, ayah_keys, locations, seq, published, content_version)
      SELECT x.id, x.surah_no, x.depth, x.role, x.text, x.text_norm, x.segments, x.records, x.stops, x.ayah_keys, x.locations, x.seq, x.published, x.content_version
      FROM jsonb_to_recordset($1::jsonb) AS x(id text, surah_no int, depth int, role text, text text, text_norm text, segments jsonb, records text[], stops int[], ayah_keys text[],
                                              locations jsonb, seq int, published boolean, content_version text)
      ON CONFLICT (id) DO UPDATE SET surah_no = EXCLUDED.surah_no, depth = EXCLUDED.depth, role = EXCLUDED.role, text = EXCLUDED.text,
        embedding = CASE WHEN rag.atoms.text_norm = EXCLUDED.text_norm THEN rag.atoms.embedding END,
        embedding_model = CASE WHEN rag.atoms.text_norm = EXCLUDED.text_norm THEN rag.atoms.embedding_model END,
        text_norm = EXCLUDED.text_norm, segments = EXCLUDED.segments, records = EXCLUDED.records, stops = EXCLUDED.stops, ayah_keys = EXCLUDED.ayah_keys,
        locations = EXCLUDED.locations, seq = EXCLUDED.seq, published = EXCLUDED.published, content_version = EXCLUDED.content_version`), [JSON.stringify(atoms)]);
    await client.query(q(schema, "DELETE FROM rag.atoms WHERE surah_no = $1 AND NOT (id = ANY ($2::text[]))"), [surahNo, atoms.map((atom) => atom.id)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  let embedded = 0;
  if (options.embed) embedded = await embedAtoms(pool, schema, surahNo, options.batch ?? 32);
  return { surah: surahNo, atoms: atoms.length, records: recordRows.length, evidence: evidenceRows.length, embedded, privateFile, unmatchedPrivate, sourceIdMissing };
}

/** Embeds the atoms of one surah that have no vector for the current model (resumable). */
export async function embedAtoms(pool: pg.Pool, schema: string, surahNo: number, batch = 32): Promise<number> {
  const todo = await pool.query<{ id: string; text_norm: string }>(
    q(schema, "SELECT id, text_norm FROM rag.atoms WHERE surah_no = $1 AND (embedding IS NULL OR embedding_model IS DISTINCT FROM $2) ORDER BY seq"), [surahNo, EMBED_MODEL_TAG]);
  for (let i = 0; i < todo.rows.length; i += batch) {
    const rows = todo.rows.slice(i, i + batch);
    const vectors = await embedPassages(rows.map((row) => row.text_norm));
    await pool.query(q(schema, "UPDATE rag.atoms a SET embedding = v.e::vector, embedding_model = $3 FROM unnest($1::text[], $2::text[]) AS v(id, e) WHERE a.id = v.id"),
      [rows.map((row) => row.id), vectors.map(vectorLiteral), EMBED_MODEL_TAG]);
  }
  return todo.rows.length;
}

/** The keys of the `SOURCES` registry of the pipeline (what tools/retrieve.py build_sources() returns), read as text; Python is not run. */
export function parseBuildSources(python: string): Map<string, { platform: string | null; platform_id: string | null }> {
  const start = python.search(/^SOURCES\s*=\s*\{/m);
  if (start < 0) throw new Error("SOURCES registry not found");
  const open = python.indexOf("{", start);
  const keys: { name: string; at: number }[] = [];
  let depth = 0, i = open, end = python.length;
  while (i < python.length) {
    const char = python[i];
    if (char === "#") { while (i < python.length && python[i] !== "\n") i++; continue; }
    if (char === "'" || char === '"') {
      const triple = python.startsWith(char.repeat(3), i);
      const quote = triple ? char.repeat(3) : char;
      const from = i;
      i += quote.length;
      while (i < python.length && !python.startsWith(quote, i)) i += python[i] === "\\" ? 2 : 1;
      const value = python.slice(from + quote.length, i);
      i += quote.length;
      if (depth === 1 && /^\s*:/.test(python.slice(i, i + 20))) keys.push({ name: value, at: from });
      continue;
    }
    if ("{[(".includes(char)) depth++;
    else if ("}])".includes(char)) { depth--; if (depth === 0) { end = i; break; } }
    i++;
  }
  const result = new Map<string, { platform: string | null; platform_id: string | null }>();
  keys.forEach((key, n) => {
    const chunk = python.slice(key.at, keys[n + 1]?.at ?? end);
    result.set(key.name, {
      platform: /\bplatform\s*=\s*'([^']*)'/.exec(chunk)?.[1] ?? null,
      platform_id: /\bplatform_book_id\s*=\s*'([^']*)'/.exec(chunk)?.[1] ?? null,
    });
  });
  return result;
}

export interface PassageOptions {
  surahMin?: number; surahMax?: number; includeDefinitionSources?: boolean; limit?: number; buildSources?: string[]; batch?: number;
  onProgress?: (done: number) => void;
}
export interface PassageIngest { passages: number; links: number; sources: number; textNormMismatch: number; buildSources: number }

/** Copies the passages in scope from the pipeline's index (read-only) into Postgres: raw book text goes nowhere else. Idempotent on `id`. */
export async function ingestPassages(pool: pg.Pool, schema: string, options: PassageOptions = {}): Promise<PassageIngest> {
  const { surahMin = PASSAGE_SURAH_MIN, surahMax = PASSAGE_SURAH_MAX, includeDefinitionSources = true, limit, batch = 300 } = options;
  const dbPath = path.join(repoRoot(), ".cache/index/sources.sqlite");
  if (!existsSync(dbPath)) throw new Error("the pipeline index .cache/index/sources.sqlite is missing");
  const registryPath = path.join(repoRoot(), ".cache/records/108/build_records_v2.py");
  const registry = existsSync(registryPath) ? parseBuildSources(readFileSync(registryPath, "utf8")) : new Map();
  const buildSources = new Set<string>(options.buildSources ?? [...registry.keys()]);

  const sqlite = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const columns = "p.id, p.source_id, p.source_title, p.author, p.unit_kind, p.section, p.book_id, p.part, p.printed_page, p.page_id, p.row_id, p.row_order, p.surah_no, p.url, p.locator_json, p.text, p.text_norm";
    const sourceList = includeDefinitionSources ? DEFINITION_SOURCES : [];
    const select = sqlite.prepare(`SELECT ${columns} FROM passages p
      WHERE p.id IN (SELECT a.passage_id FROM passage_ayahs_v2 a WHERE CAST(substr(a.ayah_key, 1, instr(a.ayah_key, ':') - 1) AS INTEGER) BETWEEN ? AND ?)
      ${sourceList.length ? `OR p.source_id IN (${sourceList.map(() => "?").join(",")})` : ""}
      ORDER BY p.id ${limit ? `LIMIT ${Math.floor(limit)}` : ""}`);
    const rows = select.iterate(surahMin, surahMax, ...sourceList) as Iterable<Record<string, any>>;
    const linkStatements = new Map<number, ReturnType<typeof sqlite.prepare>>();
    const linksFor = (ids: number[]) => {
      let statement = linkStatements.get(ids.length);
      if (!statement) { statement = sqlite.prepare(`SELECT passage_id, ayah_key, link_kind FROM passage_ayahs_v2 WHERE passage_id IN (${ids.map(() => "?").join(",")})`); linkStatements.set(ids.length, statement); }
      return statement.all(...ids) as { passage_id: number; ayah_key: string; link_kind: string }[];
    };
    const sources = new Map<string, { title: string; author: string | null }>();
    const stats: PassageIngest = { passages: 0, links: 0, sources: 0, textNormMismatch: 0, buildSources: buildSources.size };
    let chunk: Record<string, any>[] = [];

    const flush = async () => {
      if (!chunk.length) return;
      const batchRows = chunk.map((row) => {
        const textNorm = normalize(row.text);
        if (textNorm !== row.text_norm) stats.textNormMismatch++;
        sources.set(row.source_id, { title: row.source_title, author: row.author ?? null });
        return {
          id: row.id, source_id: row.source_id, unit_kind: row.unit_kind, section: row.section, book_id: row.book_id, part: row.part === null ? null : String(row.part),
          printed_page: row.printed_page === null ? null : String(row.printed_page), page_id: row.page_id, row_id: Number(row.row_id), row_order: row.row_order, surah_no: row.surah_no,
          url: row.url, locator: JSON.parse(row.locator_json), text: row.text, text_norm: textNorm, text_hash: sha256(row.text),
        };
      });
      const links = linksFor(chunk.map((row) => row.id));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(q(schema, `
          INSERT INTO rag.passages (id, source_id, unit_kind, section, book_id, part, printed_page, page_id, row_id, row_order, surah_no, url, locator, text, text_norm, text_hash)
          SELECT x.id, x.source_id, x.unit_kind, x.section, x.book_id, x.part, x.printed_page, x.page_id, x.row_id, x.row_order, x.surah_no, x.url, x.locator, x.text, x.text_norm, x.text_hash
          FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, source_id text, unit_kind text, section text, book_id int, part text, printed_page text, page_id int, row_id int, row_order int,
                                                  surah_no int, url text, locator jsonb, text text, text_norm text, text_hash text)
          ON CONFLICT (id) DO UPDATE SET source_id = EXCLUDED.source_id, unit_kind = EXCLUDED.unit_kind, section = EXCLUDED.section, book_id = EXCLUDED.book_id, part = EXCLUDED.part,
            printed_page = EXCLUDED.printed_page, page_id = EXCLUDED.page_id, row_id = EXCLUDED.row_id, row_order = EXCLUDED.row_order, surah_no = EXCLUDED.surah_no, url = EXCLUDED.url,
            locator = EXCLUDED.locator, text = EXCLUDED.text,
            embedding = CASE WHEN rag.passages.text_hash = EXCLUDED.text_hash THEN rag.passages.embedding END,
            embedding_model = CASE WHEN rag.passages.text_hash = EXCLUDED.text_hash THEN rag.passages.embedding_model END,
            text_norm = EXCLUDED.text_norm, text_hash = EXCLUDED.text_hash`), [JSON.stringify(batchRows)]);
        await client.query(q(schema, "DELETE FROM rag.passage_ayahs WHERE passage_id = ANY ($1::bigint[])"), [chunk.map((row) => row.id)]);
        await client.query(q(schema, "INSERT INTO rag.passage_ayahs (passage_id, ayah_key, link_kind) SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[]) ON CONFLICT DO NOTHING"),
          [links.map((link) => link.passage_id), links.map((link) => link.ayah_key), links.map((link) => link.link_kind)]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      stats.passages += chunk.length;
      stats.links += links.length;
      chunk = [];
      options.onProgress?.(stats.passages);
    };

    for (const row of rows) {
      chunk.push(row);
      if (chunk.length >= batch) await flush();
    }
    await flush();

    const sourceRows = [...sources].map(([id, source]) => ({
      id, title: source.title, author: source.author, platform: registry.get(id)?.platform ?? null, platform_id: registry.get(id)?.platform_id ?? null,
      build_source: buildSources.has(id), metadata: {},
    }));
    await pool.query(q(schema, `
      INSERT INTO rag.sources (id, title, author, platform, platform_id, build_source, metadata)
      SELECT x.id, x.title, x.author, x.platform, x.platform_id, x.build_source, x.metadata
      FROM jsonb_to_recordset($1::jsonb) AS x(id text, title text, author text, platform text, platform_id text, build_source boolean, metadata jsonb)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, platform = EXCLUDED.platform, platform_id = EXCLUDED.platform_id, build_source = EXCLUDED.build_source`),
      [JSON.stringify(sourceRows)]);
    stats.sources = sourceRows.length;
    return stats;
  } finally {
    sqlite.close();
  }
}

export interface EmbedProgress { done: number; total: number; seconds: number }
/** Embeds the passages of scope (a) that have no vector for the current model; resumable; shortest first so batches pad little. */
export async function embedMissingPassages(pool: pg.Pool, schema: string, options: { surahMin?: number; surahMax?: number; batch?: number; onProgress?: (progress: EmbedProgress) => void } = {}): Promise<EmbedProgress> {
  const { surahMin = PASSAGE_SURAH_MIN, surahMax = PASSAGE_SURAH_MAX, batch = 32 } = options;
  if (!embedEnabled()) throw new Error("embedding is off (set HUDA_EMBED=local and HUDA_EMBED_MODEL_DIR)");
  const todo = await pool.query<{ id: string }>(q(schema, `
    SELECT p.id::text AS id FROM rag.passages p
    WHERE (p.embedding IS NULL OR p.embedding_model IS DISTINCT FROM $3)
      AND EXISTS (SELECT 1 FROM rag.passage_ayahs a WHERE a.passage_id = p.id AND split_part(a.ayah_key, ':', 1)::int BETWEEN $1 AND $2)
    ORDER BY length(p.text_norm), p.id`), [surahMin, surahMax, EMBED_MODEL_TAG]);
  const started = performance.now();
  let done = 0;
  for (let i = 0; i < todo.rows.length; i += batch) {
    const ids = todo.rows.slice(i, i + batch).map((row) => row.id);
    const texts = await pool.query<{ id: string; text_norm: string }>(q(schema, "SELECT id::text AS id, text_norm FROM rag.passages WHERE id = ANY ($1::bigint[])"), [ids]);
    const byId = new Map(texts.rows.map((row) => [row.id, row.text_norm]));
    const vectors = await embedPassages(ids.map((id) => byId.get(id) ?? ""));
    await pool.query(q(schema, "UPDATE rag.passages p SET embedding = v.e::vector, embedding_model = $3 FROM unnest($1::bigint[], $2::text[]) AS v(id, e) WHERE p.id = v.id"),
      [ids, vectors.map(vectorLiteral), EMBED_MODEL_TAG]);
    done += ids.length;
    options.onProgress?.({ done, total: todo.rows.length, seconds: (performance.now() - started) / 1000 });
  }
  return { done, total: todo.rows.length, seconds: (performance.now() - started) / 1000 };
}

export async function tableSizes(pool: pg.Pool, schema: string): Promise<{ table: string; rows: number; bytes: number }[]> {
  withSchema("", schema); // validates the name
  const result = await pool.query<{ table: string; rows: string; bytes: string }>(`
    SELECT c.relname AS table, c.reltuples::bigint::text AS rows, pg_total_relation_size(c.oid)::text AS bytes
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`, [schema]);
  const sizes = [];
  for (const row of result.rows) {
    const count = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${schema}.${row.table}`);
    sizes.push({ table: row.table, rows: Number(count.rows[0].n), bytes: Number(row.bytes) });
  }
  return sizes;
}
