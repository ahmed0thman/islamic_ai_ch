import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node tests use explicit source extensions.
import { wideIndex, blockAnchor, blockUnit, passageRecords, unitAtAyah, indexQuestion } from "./wide-index.ts";
// @ts-expect-error -- Node tests use explicit source extensions.
import { deriveSurahMap } from "./map.ts";
// @ts-expect-error -- Node tests use explicit source extensions.
import { deriveDepthItems } from "./depth-items.ts";
import type { Block, Surah } from "./types";

const surahs: Surah[] = await Promise.all([93, 108].map(async (no) => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"))));
test("index titles keep the question and leave noun headings intact", () => {
  assert.equal(indexQuestion("Question\u061f Answer hook"), "Question\u061f");
  assert.equal(indexQuestion("Section heading"), "Section heading");
});
for (const surah of surahs) {
  test(`${surah.surah.no}: index reuses scene units and retains every stop, pin and shelf`, () => {
    const original = structuredClone(surah);
    for (const { depth } of surah.levels) {
      const map = deriveSurahMap(surah, depth), items = deriveDepthItems(surah, depth);
      const model = wideIndex(surah, map, items);
      const units = map.stops.length ? map.stops : items.units;
      assert.equal(model.units, units);
      assert.deepEqual([...model.groups.flatMap((group) => group.units), ...model.shelf].map((unit) => unit.number).sort((a, b) => a - b), units.map((unit) => unit.number).sort((a, b) => a - b));
      for (const group of model.groups) for (const unit of group.units) assert.ok(group.stations.some((station) => station.ayah.key === unit.stationKey));
      if (model.purpose) assert.ok(map.groups.flatMap((group) => group.stations).every((station) => model.purpose!.ayah_keys.includes(station.ayah.key)));
    }
    assert.deepEqual(surah, original);
  });
  test(`${surah.surah.no}: ayah lookup preserves position without a cross-depth identity`, () => {
    for (const { depth } of surah.levels) {
      const map = deriveSurahMap(surah, depth), items = deriveDepthItems(surah, depth);
      const units = map.stops.length ? map.stops : items.units;
      assert.equal(unitAtAyah(units, null), undefined);
      assert.equal(unitAtAyah(units, "999:999"), undefined);
      for (const unit of units.filter((item) => item.stationKey)) assert.equal(unitAtAyah(units, unit.stationKey)?.stationKey, unit.stationKey);
      const own = new Set(surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).map((ayah) => ayah.key));
      for (const block of map.continuousBlocks) {
        const anchor = blockAnchor(block, units, surah.records, surah.surah.no);
        if (anchor) assert.ok(own.has(anchor));
      }
    }
  });
}
test("depth details in the same section keep distinct pin and shelf targets", () => {
  const surah = surahs[0], items = deriveDepthItems(surah, 3);
  assert.ok(items.pins.length > 1 && items.shelf.length);
  for (const pin of items.pins) {
    const block = pin.scene[pin.openIndex!];
    assert.equal(blockUnit(block, items.units), pin);
    assert.equal(blockAnchor(block, items.units, surah.records, surah.surah.no), pin.stationKey);
  }
  for (const shelf of items.shelf) {
    const heading: Block = { type: "heading", text: shelf.title };
    assert.equal(blockUnit(heading, items.units), shelf);
  }
});
test("passage record summaries count cited records once and do not alter reading content", () => {
  const surah = surahs[0], keys = [surah.passages![0].from];
  for (const { depth } of surah.levels) {
    const records = passageRecords(surah, depth, keys);
    assert.equal(new Set(records.map((record) => record.id)).size, records.length);
    for (const record of records) { assert.equal(surah.records[record.id], record); assert.ok(record.ayah_keys.some((key) => keys.includes(key))); }
  }
});
