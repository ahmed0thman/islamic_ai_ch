import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires the source extension; no files are emitted.
import { mean, percentile, recallAt, reciprocalRankAt } from "./eval-metrics.ts";
// @ts-expect-error -- Node requires the source extension; no files are emitted.
import { ragMode, searchAtoms } from "./retrieve.ts";
// @ts-expect-error -- Node requires the source extension; no files are emitted.
import { getPool } from "./db.ts";

test("recall and MRR use gold only, bounded ranks and unique hits", () => {
  const hits = ["other", "a", "a", "b"];
  assert.equal(recallAt(hits, ["a", "b"], 3), 0.5);
  assert.equal(recallAt(hits, ["a", "a", "b"], 4), 1);
  assert.equal(reciprocalRankAt(hits, ["a", "b"]), 0.5);
  assert.equal(reciprocalRankAt(hits, ["b"], 3), 0);
  assert.equal(recallAt([], ["a"], 8), 0);
  assert.equal(reciprocalRankAt([], ["a"]), 0);
  assert.equal(recallAt(hits, [], 8), null);
  assert.equal(reciprocalRankAt(hits, []), null);
  assert.equal(mean([0, 0.5, 1]), 0.5);
  assert.equal(mean([]), null);
  assert.equal(percentile([40, 10, 30, 20], 0.5), 25);
  assert.equal(percentile([40, 10, 30, 20], 0.95), 38.5);
  assert.equal(percentile([], 0.95), null);
});

test("explicit modes override the default and preserve the inherited switch", () => {
  const saved = process.env.HUDA_RAG_MODE;
  try {
    process.env.HUDA_RAG_MODE = "dense";
    assert.equal(ragMode(), "dense");
    assert.equal(ragMode("lexical"), "lexical");
    assert.equal(ragMode("hybrid"), "hybrid");
    assert.equal(process.env.HUDA_RAG_MODE, "dense");
    process.env.HUDA_RAG_MODE = "lexical";
    assert.equal(ragMode("semantic"), "dense");
    assert.equal(ragMode(), "lexical");
    delete process.env.HUDA_RAG_MODE;
    assert.equal(ragMode(), "hybrid");
  } finally {
    if (saved === undefined) delete process.env.HUDA_RAG_MODE; else process.env.HUDA_RAG_MODE = saved;
  }
});

const databaseUrl = process.env.HUDA_TEST_DATABASE_URL || process.env.DATABASE_URL;
test("per-call retrieval mode overrides the environment without mutating it", {
  skip: databaseUrl ? false : "DATABASE_URL/HUDA_TEST_DATABASE_URL is not set",
}, async () => {
  const savedUrl = process.env.DATABASE_URL, savedMode = process.env.HUDA_RAG_MODE;
  const savedEmbed = process.env.HUDA_EMBED;
  process.env.DATABASE_URL = databaseUrl;
  process.env.HUDA_RAG_MODE = "dense";
  process.env.HUDA_EMBED = "off";
  try {
    const lexical = await searchAtoms({ question: "retrieval probe", surah: 108, depth: 1, mode: "lexical" });
    assert.equal(lexical.mode, "lexical");
    const semantic = await searchAtoms({ question: "retrieval probe", surah: 108, depth: 1, mode: "semantic" });
    assert.equal(semantic.mode, "lexical", "semantic without embeddings reports lexical fallback");
    assert.equal(process.env.HUDA_RAG_MODE, "dense");
  } finally {
    await getPool(databaseUrl)?.end();
    for (const [key, value] of Object.entries({ DATABASE_URL: savedUrl, HUDA_RAG_MODE: savedMode, HUDA_EMBED: savedEmbed })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
