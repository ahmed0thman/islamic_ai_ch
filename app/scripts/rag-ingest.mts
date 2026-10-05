// Fills the retrieval store: verified sentences, records and (with --passages) book passages.
//   pnpm rag:ingest [--surah 93 --surah 108 | --surah 93,108] [--passages [--embed-passages]] [--build-sources a,b,c] [--schema rag]
// DATABASE_URL, HUDA_EMBED=local and HUDA_EMBED_MODEL_DIR come from the environment and are never printed. Counts only are printed.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { applySchema, embedMissingPassages, ingestPassages, ingestSurah, tableSizes } from "../src/lib/rag/ingest.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { publishedSurahs } from "../src/lib/published.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { embedEnabled, embedInfo, embedLoadRssMb, warmEmbed } from "../src/lib/rag/embed.ts";

const args = process.argv.slice(2);
const values = (flag: string) => args.flatMap((arg, i) => (arg === flag ? (args[i + 1] ?? "").split(",") : [])).filter(Boolean);
const has = (flag: string) => args.includes(flag);

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const schema = values("--schema")[0] ?? "rag";
const pool = new pg.Pool({ connectionString: url, max: 3 });
const embedAtoms = embedEnabled();
const cwd = process.cwd();

try {
  const published = (JSON.parse(readFileSync(path.join(cwd, "src/content/index.json"), "utf8")) as { surahs: { no: number }[] }).surahs.map((surah) => surah.no);
  // The reader publishes the surahs listed in src/lib/published.ts; the content index holds more (drafts). Only published ones are ingested.
  const wanted = values("--surah").map(Number);
  const surahs = (wanted.length ? wanted : [...publishedSurahs]).filter((no) => published.includes(no));
  if (wanted.length && surahs.length !== wanted.length) throw new Error("a requested surah is not in the content index");

  await applySchema(pool, schema);
  console.log(`schema ${schema} ready`);
  if (embedAtoms) { await warmEmbed(); console.log(JSON.stringify({ embed: "local", ...embedInfo() })); }

  for (const surah of surahs) {
    const result = await ingestSurah(pool, schema, surah, { embed: embedAtoms });
    console.log(JSON.stringify({ ...result, privateFile: result.privateFile }));
  }

  if (has("--passages")) {
    const buildSources = values("--build-sources");
    const started = performance.now();
    const result = await ingestPassages(pool, schema, { buildSources: buildSources.length ? buildSources : undefined, onProgress: (done: number) => { if (done % 3000 < 300) console.log(`passages ${done}`); } });
    console.log(JSON.stringify({ passagesIngested: result, seconds: Math.round((performance.now() - started) / 1000) }));
    if (has("--embed-passages")) {
      const progress = await embedMissingPassages(pool, schema, {
        onProgress: (p: { done: number; total: number; seconds: number }) => { if (p.done % 640 < 32) console.log(`embedded ${p.done}/${p.total} (${(p.done / p.seconds).toFixed(1)} per second)`); },
      });
      console.log(JSON.stringify({ passagesEmbedded: progress.done, of: progress.total, seconds: Math.round(progress.seconds), per_second: Number((progress.done / Math.max(progress.seconds, 0.001)).toFixed(2)), model_rss_mb_after_load: embedLoadRssMb(), ...embedInfo() }));
    }
  }

  console.log(JSON.stringify({ tables: await tableSizes(pool, schema) }));
} finally {
  await pool.end();
}
