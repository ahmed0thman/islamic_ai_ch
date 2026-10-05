import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import pg from "pg";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveAtoms } from "../ask/atoms.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { fuse, passageLocator, retrieveAtoms, retrievePassages, searchAtoms } from "./retrieve.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { applySchema, ingestPassages, ingestSurah, repoRoot } from "./ingest.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { STOPWORDS } from "./stopwords.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { tokenize } from "./query.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { DEFINITION_SOURCES } from "./scope.ts";
import type { Atom } from "../ask/types";

const fixtures = JSON.parse(await readFile(new URL("../ask/eval-fixtures.json", import.meta.url), "utf8")) as { question: string }[];
const safety = (JSON.parse(await readFile(new URL("../../../../tools/data/eval/safety_cases.json", import.meta.url), "utf8")) as { cases: { id: string; question: string }[] }).cases;
const questions = [fixtures[0].question, fixtures[1].question, safety.find((item) => item.id.startsWith("huda"))!.question];
const surah108 = JSON.parse(await readFile(new URL("../../content/surah-108.json", import.meta.url), "utf8"));
const derived = deriveAtoms(surah108) as Atom[];

test("without DATABASE_URL the atoms are the open surah's own and passages are off", async () => {
  delete process.env.DATABASE_URL;
  let asked = 0;
  const result = await retrieveAtoms({ question: questions[0], surah: 108, depth: 1 }, async (surah: number) => { asked = surah; return derived; });
  assert.equal(result.mode, "fallback");
  assert.equal(asked, 108);
  assert.deepEqual(result.atoms, derived);
  const passages = await retrievePassages({ question: questions[0], surah: 108 });
  assert.deepEqual({ passages: passages.passages, mode: passages.mode }, { passages: [], mode: "off" });
});

test("a database that cannot be reached falls back and never throws", async () => {
  process.env.DATABASE_URL = "postgresql://127.0.0.1:1/none";
  try {
    const result = await retrieveAtoms({ question: questions[0], surah: 108, depth: 1 }, async () => derived);
    assert.equal(result.mode, "fallback");
    assert.equal(result.atoms.length, derived.length);
    assert.equal((await retrievePassages({ question: questions[0], surah: 108 })).mode, "off");
  } finally { delete process.env.DATABASE_URL; }
});

test("a passage locator is digits and separators only", () => {
  assert.equal(passageLocator({ part: "3", printed_page: "45", page_id: 9 }), "3/45");
  assert.equal(passageLocator({ part: null, printed_page: "45", page_id: 9 }), "45");
  assert.equal(passageLocator({ part: null, printed_page: null, page_id: 9 }), "9");
  assert.equal(passageLocator({ part: null, printed_page: null, page_id: null }), "");
});

const testUrl = process.env.HUDA_TEST_DATABASE_URL;
const indexPresent = existsSync(path.join(repoRoot(), ".cache/index/sources.sqlite"));
const skipIntegration = testUrl ? false : "HUDA_TEST_DATABASE_URL is not set (the integration tests need a Postgres with pgvector and the arabic text-search configuration)";
const SCHEMA = "rag_test";

test("integration: ingest surah 108 and retrieve atoms and passages", { skip: skipIntegration }, async (t) => {
  const admin = new pg.Pool({ connectionString: testUrl, max: 2 });
  process.env.DATABASE_URL = testUrl;
  process.env.HUDA_RAG_SCHEMA = SCHEMA;
  const savedMode = process.env.HUDA_RAG_MODE;
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await applySchema(admin, SCHEMA);
    await applySchema(admin, SCHEMA); // idempotent
    const ingested = await ingestSurah(admin, SCHEMA, 108, { embed: false });
    assert.equal(ingested.atoms, derived.length);
    const again = await ingestSurah(admin, SCHEMA, 108, { embed: false });
    assert.equal(again.atoms, derived.length);
    const stored = await admin.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.atoms`);
    assert.equal(stored.rows[0].n, derived.length, "re-ingest keeps one row per atom");
    const derivedIds = new Set(derived.map((atom) => atom.id));

    await t.test("atoms: every returned id comes from deriveAtoms(108); the open stop is always present", async () => {
      const place = derived.flatMap((atom) => atom.locations ?? []).find((location) => location.depth === 1 && location.stops.length);
      assert.ok(place, "surah 108 has a stop at depth 1");
      const stop = place.stops[0];
      const inStop = derived.filter((atom) => atom.locations?.some((location) => location.depth === 1 && location.stops.includes(stop))).map((atom) => atom.id);
      assert.ok(inStop.length > 0);
      for (const question of questions) {
        const withStop = await retrieveAtoms({ question, surah: 108, depth: 1, stop }, async () => { throw new Error("fallback must not run"); });
        assert.equal(withStop.mode, "lexical");
        assert.ok(withStop.atoms.length > 0);
        for (const atom of withStop.atoms) assert.ok(derivedIds.has(atom.id), "known atom id");
        const ids = withStop.atoms.map((atom) => atom.id);
        assert.equal(new Set(ids).size, ids.length, "no atom twice");
        for (const id of inStop) assert.ok(ids.includes(id), "open-stop atom present");
        assert.deepEqual(ids.slice(0, inStop.length).sort(), [...inStop].sort(), "open-stop atoms come first");
        const shape = withStop.atoms[0];
        const original = derived.find((atom) => atom.id === shape.id)!;
        assert.deepEqual(shape, original, "same shape as deriveAtoms");
      }
    });

    await t.test("atoms: a definition travels with the sentence that carries its term; history atoms are kept", async () => {
      const definition = derived.find((atom) => atom.id.includes(":term:"))!;
      const carrier = derived.find((atom) => !atom.id.includes(":term:") && atom.segments.some((part) => part.t === "term" && part.record === definition.records[0]))!;
      const result = await retrieveAtoms({ question: tokenize(carrier.text).slice(0, 4).join(" "), surah: 108, depth: 1, historyAtomIds: [carrier.id] }, async () => derived);
      assert.ok(result.atoms.some((atom) => atom.id === carrier.id));
      assert.ok(result.atoms.some((atom) => atom.id === definition.id));
    });

    await t.test("atoms: the SQL fusion scores equal fuse()", async () => {
      const { rows } = await searchAtoms({ question: tokenize(derived[3].text).slice(0, 5).join(" "), surah: 108, depth: 1 });
      const ranked = rows.filter((row) => row.lex_rank !== null);
      assert.ok(ranked.length > 0);
      const longest = Math.max(...ranked.map((row) => row.lex_rank!));
      const list = Array.from({ length: longest }, (_, i) => `__${i}`);
      for (const row of ranked) list[row.lex_rank! - 1] = row.atom.id;
      const boosts = new Map<string, number>(ranked.map((row) => [row.atom.id, 0.01]));
      const expected = new Map<string, number>(fuse([list], boosts).map((item: { id: string; score: number }) => [item.id, item.score]));
      for (const row of ranked) assert.ok(Math.abs(row.score! - expected.get(row.atom.id)!) < 1e-9, "SQL score equals fuse() plus the surah boost");
    });

    await t.test("atoms: a question of stop words only returns the open stop without failing", async () => {
      const result = await retrieveAtoms({ question: [...STOPWORDS].slice(0, 3).join(" "), surah: 108, depth: 1 }, async () => derived);
      assert.notEqual(result.mode, "fallback");
    });

    await t.test("atoms: HUDA_RAG_MODE=dense without a vector degrades to lexical and says so", async () => {
      process.env.HUDA_RAG_MODE = "dense";
      try {
        const result = await retrieveAtoms({ question: questions[0], surah: 108, depth: 1 }, async () => derived);
        assert.equal(result.mode, process.env.HUDA_EMBED === "local" ? "dense" : "lexical");
      } finally { if (savedMode === undefined) delete process.env.HUDA_RAG_MODE; else process.env.HUDA_RAG_MODE = savedMode; }
    });

    await t.test("passages: only passages linked to surah 108 (or a definition source), each with a source title and text", { skip: indexPresent ? false : "the pipeline index is not on this machine" }, async () => {
      const result = await ingestPassages(admin, SCHEMA, { surahMin: 108, surahMax: 108, includeDefinitionSources: false, limit: 12 });
      assert.equal(result.passages, 12);
      const links = await admin.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.passage_ayahs WHERE ayah_key LIKE '108:%'`);
      assert.ok(links.rows[0].n > 0);
      const probe = (await admin.query(`SELECT id::text AS id, text_norm FROM ${SCHEMA}.passages WHERE length(text_norm) > 200 ORDER BY id LIMIT 1`)).rows[0];
      assert.ok(probe, "a probe passage");
      const probeQuestion = tokenize(probe.text_norm).filter((word: string) => word.length > 3).slice(0, 4).join(" ");
      for (const question of [...questions, probeQuestion]) {
        const found = await retrievePassages({ question, surah: 108, stopAyahs: ["108:1"] });
        assert.ok(found.mode === "lexical" || found.mode === "hybrid");
        for (const passage of found.passages) {
          assert.ok(passage.source_title.length > 0 || DEFINITION_SOURCES.includes(passage.source_id) === false, "source title");
          assert.ok(passage.text.length > 0);
          assert.ok(passage.ayah_keys.length > 0 || DEFINITION_SOURCES.includes(passage.source_id));
          for (const key of passage.ayah_keys) assert.match(key, /^108:\d+$/);
          assert.match(passage.locator, /^[0-9/]*$/);
        }
      }
      const probeFound = await retrievePassages({ question: probeQuestion, surah: 108 });
      assert.ok(probeFound.passages.some((passage: { id: string }) => passage.id === probe.id), "the passage found by its own words");
      const other = await retrievePassages({ question: probeQuestion, surah: 93 });
      assert.ok(!other.passages.some((passage: { id: string }) => passage.id === probe.id), "a passage linked to 108 only is not offered for 93");
    });
  } finally {
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => undefined);
    await admin.end();
    delete process.env.DATABASE_URL;
    delete process.env.HUDA_RAG_SCHEMA;
  }
});
