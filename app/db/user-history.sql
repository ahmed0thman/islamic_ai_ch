-- The signed-in reader's saved history (optional sign-in, flag NEXT_PUBLIC_HUDA_AUTH). Idempotent.
-- Written for the schema `rag` like rag.sql; the loader (app/src/lib/rag/db.ts) rewrites the prefix when another name is requested.
CREATE SCHEMA IF NOT EXISTS rag;

CREATE TABLE IF NOT EXISTS rag.user_questions (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,  -- the sign-in id; never logged
  surah_no int NOT NULL,
  depth int NOT NULL,
  stop int,
  question text NOT NULL,
  atom_ids text[] NOT NULL DEFAULT '{}',
  asked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_no, question, asked_at)
);

CREATE INDEX IF NOT EXISTS user_questions_user_surah_asked_idx
  ON rag.user_questions (user_id, surah_no, asked_at DESC);

CREATE TABLE IF NOT EXISTS rag.user_progress (
  user_id text NOT NULL,
  surah_no int NOT NULL,
  depth int NOT NULL,
  stop int,
  visited int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surah_no)
);
