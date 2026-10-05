-- Retrieval store for the reader's assistant. Idempotent: safe to run on every ingest.
-- Requires the pgvector extension (enabled below); Render's managed Postgres offers it on major versions 13-18.
-- The loader (app/src/lib/rag/db.ts) rewrites the `rag.` prefix when another schema name is requested (tests use rag_test).
DO $$ BEGIN PERFORM 'arabic'::regconfig; END $$;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS rag;

CREATE TABLE IF NOT EXISTS rag.sources (
  id text PRIMARY KEY, title text, author text, platform text, platform_id text,
  build_source boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rag.records (
  id text PRIMARY KEY, surah_no int NOT NULL, claim text NOT NULL, badge text, state text,
  status_text text NOT NULL DEFAULT '', depth_min int NOT NULL, ayah_keys text[] NOT NULL,
  science text, icons text[] NOT NULL,
  display_decision text NOT NULL,  -- copied as-is from the private record file
  build_decision text, review_status text, content_version text NOT NULL
);

CREATE TABLE IF NOT EXISTS rag.evidence (
  record_id text REFERENCES rag.records(id) ON DELETE CASCADE, ord int NOT NULL, icon text,
  source_id text, source_title text, author text, locator text, quote text, url text,
  rulings jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (record_id, ord)
);

-- One row per answer unit of deriveAtoms(): a sentence that ends in one marker, or a term's definition (role 'definition').
-- `seq` is the position in deriveAtoms() output; `locations` keeps every depth/stops the sentence sits in (duplicates merged under the lowest depth),
-- `depth` is the atom's own level and `stops` the union of the stops of all its locations.
CREATE TABLE IF NOT EXISTS rag.atoms (
  id text PRIMARY KEY, surah_no int NOT NULL, depth int NOT NULL, role text NOT NULL,  -- 'claim' | 'transmission' | 'definition'
  text text NOT NULL, text_norm text NOT NULL, segments jsonb NOT NULL, records text[] NOT NULL,
  stops int[] NOT NULL DEFAULT '{}', ayah_keys text[] NOT NULL DEFAULT '{}',
  locations jsonb NOT NULL DEFAULT '[]', seq int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true, content_version text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('arabic', text_norm)) STORED,
  embedding vector(384), embedding_model text
);

-- Book passages: answer material of the assistant (decision 086). Raw book text lives only here.
CREATE TABLE IF NOT EXISTS rag.passages (
  id bigint PRIMARY KEY, source_id text NOT NULL, unit_kind text, section text, book_id int, part text,
  printed_page text, page_id int, row_id int, row_order int, surah_no int, url text,
  locator jsonb NOT NULL, text text NOT NULL, text_norm text NOT NULL, text_hash text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('arabic', text_norm)) STORED,
  embedding vector(384), embedding_model text,
  has_report boolean NOT NULL DEFAULT false  -- left false here; a later step fills it
);

CREATE TABLE IF NOT EXISTS rag.passage_ayahs (
  passage_id bigint REFERENCES rag.passages(id) ON DELETE CASCADE, ayah_key text NOT NULL, link_kind text NOT NULL,
  PRIMARY KEY (passage_id, ayah_key, link_kind)
);

-- Written only when HUDA_ASK_LOG_QUESTIONS=1 (the owner's decision is pending); nothing writes to it by default.
CREATE TABLE IF NOT EXISTS rag.questions (
  id bigserial PRIMARY KEY, asked_at timestamptz DEFAULT now(), surah_no int, depth int, stop int,
  question text, status text, atom_ids text[], retrieval jsonb
);

CREATE INDEX IF NOT EXISTS atoms_tsv_idx ON rag.atoms USING gin (tsv);
CREATE INDEX IF NOT EXISTS passages_tsv_idx ON rag.passages USING gin (tsv);
CREATE INDEX IF NOT EXISTS atoms_surah_idx ON rag.atoms (surah_no);
CREATE INDEX IF NOT EXISTS records_surah_idx ON rag.records (surah_no);
-- text_pattern_ops serves both equality and the prefix match `ayah_key LIKE '108:%'`.
CREATE INDEX IF NOT EXISTS passage_ayahs_ayah_idx ON rag.passage_ayahs (ayah_key text_pattern_ops);
CREATE INDEX IF NOT EXISTS passages_source_idx ON rag.passages (source_id);
-- No vector index: exact scan is fast enough below 100k rows, and exact is what the evaluation wants.
