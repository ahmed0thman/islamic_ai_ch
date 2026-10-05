import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node's native TypeScript runner needs the source extension.
import { relationRecords, blockRelationIds } from "./relations.ts";
import type { Surah } from "./types";
const index = JSON.parse(await readFile(new URL("../../../content/export/index.json", import.meta.url), "utf8"));
const surahs: Surah[] = await Promise.all(index.surahs.map(async ({ no }: { no: number }) => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"))));
test("only explicitly cited, permitted link records with two own ayahs are eligible", () => {
  let found = false, broad = false;
  for (const surah of surahs) for (const level of surah.levels) {
    const snapshot = structuredClone(surah);
    const own = new Set(surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).map((ayah) => ayah.key));
    const cited = new Set(level.blocks.flatMap(blockRelationIds));
    const expected = Object.values(surah.records).filter((record) => record.icons.includes("link") && record.depth_min <= level.depth
      && cited.has(record.id) && new Set(record.ayah_keys.filter((key) => own.has(key))).size === 2);
    const actual = relationRecords(surah, level.depth);
    assert.deepEqual(actual.map((record) => record.id).sort(), expected.map((record) => record.id).sort());
    for (const record of actual) { assert.strictEqual(record, surah.records[record.id]); found = true; }
    for (const record of Object.values(surah.records)) if (record.icons.includes("link") && record.ayah_keys.filter((key) => own.has(key)).length > 2) { broad = true; assert.ok(!actual.includes(record)); }
    assert.deepEqual(surah, snapshot);
  }
  assert.ok(found && broad, "real exports contain eligible pairs and a broad relation");
});
test("relations do not bypass citation or depth permissions or expand broad records into pairs", () => {
  const surah = surahs.find((item) => item.surah.no === 93)!;
  for (const depth of [0, 1] as const)
    for (const record of relationRecords(surah, depth)) assert.ok(record.depth_min <= depth);
  const eligible = relationRecords(surah, 2);
  assert.ok(eligible.length > 0);
  for (const record of eligible) {
    assert.ok(record.evidence.some((evidence) => evidence.link_strength === "unrated"));
    const copy = structuredClone(surah); copy.records[record.id].depth_min = 3;
    assert.ok(!relationRecords(copy, 2).some((item) => item.id === record.id));
  }
  assert.deepEqual(relationRecords({ ...surah, levels: [{ depth: 2, blocks: [] }] }, 2), []);
});
