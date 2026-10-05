# Rebuilding the RAG database from scratch

Render's free Postgres expires 30 days after creation, then gets a 14-day grace period, then
is deleted together with its data. The whole database is generated from the private source
files, so a rebuild takes minutes.

## Steps (owner, from the owner's machine)

The fill reads the private book-passage files under `.cache/`, which are not in the
repository, so the ingest always runs on the owner's machine, never on Render.

1. In the Render dashboard, create a new free Postgres database (the Blueprint creates
   `huda-rag` on the first deploy; a replacement can reuse the same name once the expired
   one is deleted). Copy its EXTERNAL connection URL; the internal URL is not reachable
   from outside Render.
2. From the `app/` folder of this repository (the SQL files load from `process.cwd()/db` and
   the content index from `src/content/index.json`):

       DATABASE_URL=<external url> HUDA_EMBED=off pnpm rag:ingest --passages

   `HUDA_EMBED=off` keeps the fill lexical-only, matching the deployed service (the embedding
   model needs about 700 MB of memory). Adding vectors for the published sentences is optional
   and also runs on the owner's machine with the model:

       HUDA_EMBED=local HUDA_EMBED_MODEL_DIR=<model dir> pnpm rag:ingest

3. Set the service's `DATABASE_URL` to the new database's INTERNAL connection string in the
   Render dashboard (service `huda` > Environment). With the Blueprint, `DATABASE_URL` is
   wired from the database named `huda-rag`, so a same-named replacement is picked up on the
   next deploy.

The ingest recreates the schema from `app/db/*.sql`, loads the verified sentences and records
of the published surahs, and with `--passages` the book passages.
