import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveDepthItems, depthHero, depthPlaylist, sceneNeighbours } from "./depth-items.ts";
import type { Block, Surah } from "./types";

const surahs: Surah[] = await Promise.all([108, 93, 107, 111].map(async (no) =>
  JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8")),
));
const numberOf = (key: string) => Number(key.split(":")[1]);
type Details = Extract<Block, { type: "details" }>;
const detailsOf = (surah: Surah, depth: 0 | 1 | 2 | 3) => surah.levels.find((level) => level.depth === depth)!.blocks.flatMap((block, index) => block.type === "details" ? [{ block, index }] : []);

for (const surah of surahs) {
  test(`${surah.surah.no}: each details item is one pin under the earliest own ayah its title records point to`, () => {
    const snapshot = structuredClone(surah);
    const model = deriveDepthItems(surah, 3);
    const details = detailsOf(surah, 3);
    assert.equal(model.pins.length, details.length);
    assert.deepEqual(model.pins.map((pin) => pin.blockIndex).sort((a, b) => a - b), details.map((item) => item.index));
    for (const pin of model.pins) {
      const original = details.find((item) => item.index === pin.blockIndex)!.block as Details;
      assert.strictEqual(pin.scene[pin.openIndex!], original);
      const own = original.title.flatMap((segment) => segment.t === "mark" ? segment.records : [])
        .flatMap((id) => surah.records[id].ayah_keys).filter((key) => key.startsWith(`${surah.surah.no}:`));
      assert.equal(pin.stationKey, own.sort((a, b) => numberOf(a) - numberOf(b))[0]);
      assert.deepEqual(pin.ayahKeys, [pin.stationKey]);
      assert.equal(pin.kind, "pin");
      const section = model.shelf.find((unit) => unit.scene === pin.scene)!;
      assert.deepEqual(pin.recordIds, section.recordIds);
      assert.ok(pin.icons.every((icon) => section.icons.includes(icon)));
    }
    assert.deepEqual(model.pins.map((pin) => numberOf(pin.stationKey)), model.pins.map((pin) => numberOf(pin.stationKey)).sort((a, b) => a - b));
    assert.deepEqual(model, deriveDepthItems(structuredClone(surah), 3));
    assert.deepEqual(surah, snapshot);
  });

  test(`${surah.surah.no}: shelf sections hold every paragraph and details block exactly once, numbers are contiguous`, () => {
    const model = deriveDepthItems(surah, 3);
    const level = surah.levels.find((item) => item.depth === 3)!.blocks;
    const content = level.filter((block) => block.type === "paragraph" || block.type === "details");
    const shelved = model.shelf.flatMap((unit) => unit.scene);
    assert.equal(shelved.length, content.length);
    content.forEach((block) => assert.equal(shelved.filter((item) => item === block).length, 1));
    assert.deepEqual(model.units.map((unit) => unit.number), model.units.map((_, index) => index + 1));
    assert.deepEqual(model.units, [...model.pins, ...model.shelf]);
    assert.equal(new Set(model.units.map((unit) => unit.blockIndex)).size, model.units.length);
    for (const unit of model.shelf) {
      assert.equal(unit.kind, "section");
      assert.equal(unit.stationKey, "");
      assert.deepEqual(unit.ayahKeys, []);
      assert.ok(unit.title.length > 0);
    }
  });

  test(`${surah.surah.no}: levels that already have titled stops keep their map and get no depth items`, () => {
    for (const depth of [0, 1, 2] as const) assert.deepEqual(deriveDepthItems(surah, depth), { pins: [], shelf: [], units: [] });
  });
}

test("playlists, neighbours and the hero follow pins and shelf", () => {
  const model = deriveDepthItems(surahs[0], 3);
  assert.ok(model.pins.length > 1 && model.shelf.length > 0);
  assert.strictEqual(depthPlaylist(model, model.pins[0]), model.pins);
  assert.strictEqual(depthPlaylist(model, model.shelf[0]), model.shelf);
  assert.deepEqual(sceneNeighbours(model.pins, model.pins[0].number), { previous: undefined, next: model.pins[1] });
  assert.deepEqual(sceneNeighbours(model.pins, model.pins.at(-1)!.number).next, undefined);
  assert.deepEqual(sceneNeighbours(model.pins, 9999), { previous: undefined, next: undefined });
  assert.strictEqual(depthHero(model, 1, true), model.shelf[0]);
  const last = Math.max(...model.pins.map((pin) => numberOf(pin.stationKey)));
  assert.strictEqual(depthHero(model, last, false), model.pins.find((pin) => numberOf(pin.stationKey) >= last));
  assert.strictEqual(depthHero(model, last + 1, false), model.shelf[0]);
});

test("a title without an own-ayah record has no pin, a headingless section is named by the surah, badges come from the title", () => {
  const surah: Surah = structuredClone(surahs[0]);
  const level = surah.levels.find((item) => item.depth === 3)!;
  const record = (id: string, ayah_keys: string[], badge: "la_yathbut" | null) => ({ id, icons: ["scholar"], badge, claim: "x", status_text: "", depth_min: 0, ayah_keys, evidence: [] }) as unknown as Surah["records"][string];
  surah.records.t1 = record("t1", ["2:1"], null);
  surah.records.t2 = record("t2", ["108:2"], "la_yathbut");
  const item = (title: Details["title"]): Details => ({ type: "details", title, blocks: [] });
  level.blocks = [
    item([{ t: "text", v: "foreign" }, { t: "mark", records: ["t1"] }]),
    item([{ t: "text", v: "  two   words " }, { t: "term", v: "term", record: "t2" }, { t: "mark", records: ["t2"] }]),
  ];
  const model = deriveDepthItems(surah, 3);
  assert.equal(model.pins.length, 1);
  assert.equal(model.pins[0].title, "two words term");
  assert.deepEqual(model.pins[0].badges, ["la_yathbut"]);
  assert.equal(model.pins[0].stationKey, "108:2");
  assert.equal(model.shelf.length, 1);
  assert.equal(model.shelf[0].title, surah.surah.name);
  assert.equal(model.pins[0].sceneTitle, surah.surah.name);
  assert.equal(model.pins[0].openIndex, 1);
});
