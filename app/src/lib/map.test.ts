import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveEarlyMisconceptions, deriveSurahMap, heroStop, stopNeighbours } from "./map.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { scopeContains, type Scope } from "./scope.ts";
import type { MapStop, SurahMapModel } from "./map";
import type { Block, Depth, IconKey, ParagraphBlock, SourceRecord, Surah } from "./types";

const surahs: Surah[] = await Promise.all([108, 93, 111, 112].map(async (no) =>
  JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8")),
));
const isTitled = (block: Block | undefined): block is ParagraphBlock & { title: string } => block?.type === "paragraph" && Boolean(block.title);
/** A stop of the level's own blocks. An early door (a misconception stop of a deeper level, shown on this one) is not. */
const isOwn = (stop: MapStop) => stop.fromDepth === undefined;

for (const surah of surahs) {
  test(`${surah.surah.no}: every titled paragraph becomes exactly one stop of its level without mutating content`, () => {
    const snapshot = structuredClone(surah);
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      const own = map.stops.filter(isOwn);
      const titled = level.blocks.filter(isTitled);
      assert.equal(own.length, titled.length);
      assert.equal(new Set(own.map((stop) => stop.blockIndex)).size, titled.length);
      assert.deepEqual(own.map((stop) => stop.blockIndex).sort((a, b) => a - b),
        level.blocks.flatMap((block, index) => isTitled(block) ? [index] : []));
      for (const stop of own) {
        const original = level.blocks[stop.blockIndex];
        assert.ok(isTitled(original));
        assert.equal(stop.title, original.title);
        assert.strictEqual(stop.scene[0], original);
        assert.deepEqual(stop.ayahKeys, original.ayahs);
      }
      assert.deepEqual(map, deriveSurahMap(structuredClone(surah), level.depth));
    }
    assert.deepEqual(surah, snapshot);
  });

  test(`${surah.surah.no}: stations contain only the surah's own ayahs and stops in block order`, () => {
    const own = surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).sort((a, b) => a.no - b.no);
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      assert.deepEqual(map.groups.flatMap((group) => group.stations.map((station) => station.ayah)), own);
      for (const group of map.groups) {
        for (const station of group.stations) {
          const expected = level.blocks.filter(isTitled).filter((block) =>
            block.ayahs?.[0] === station.ayah.key && block.passage === group.passage?.id,
          );
          assert.deepEqual(station.stops.filter(isOwn).map((stop) => stop.scene[0]), expected);
          // The level's own stops first, then the early doors that hang from the same ayah.
          assert.deepEqual(station.stops.map(isOwn), [...station.stops.map(isOwn)].sort((a, b) => Number(b) - Number(a)));
          for (const stop of station.stops) {
            assert.equal(stop.stationKey, stop.ayahKeys[0]);
            assert.equal(stop.stationKey, station.ayah.key);
            assert.ok(own.some((ayah) => ayah.key === stop.stationKey));
          }
        }
      }
    }
  });

  test(`${surah.surah.no}: scenes include all following untitled paragraphs and their record icons`, () => {
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      const assigned = new Set<Block>();
      for (const stop of map.stops.filter(isOwn)) {
        const expected = [level.blocks[stop.blockIndex]];
        for (let index = stop.blockIndex + 1; index < level.blocks.length; index++) {
          const block = level.blocks[index];
          // The closing summary is the surah's, never part of the last stop's scene.
          if (block.type !== "paragraph" || block.title || block.kind === "summary") break;
          expected.push(block);
        }
        assert.deepEqual(stop.scene, expected);
        stop.scene.forEach((block) => { assert.ok(!assigned.has(block)); assigned.add(block); });
        const ids = [...new Set(stop.scene.flatMap((paragraph) => paragraph.segments.flatMap((segment) =>
          segment.t === "mark" ? segment.records : segment.t === "term" || segment.t === "quote" ? [segment.record] : [],
        )))];
        assert.deepEqual(stop.recordIds, ids);
        assert.ok(stop.recordIds.every((id) => Object.hasOwn(surah.records, id)));
        const icons = [...new Set(ids.flatMap((id) => surah.records[id].icons))].sort();
        assert.deepEqual([...stop.icons].sort(), icons);
      }
      const duplicateHeadings = level.blocks.filter((block, index) => block.type === "heading" && block.kind === "question"
        && isTitled(level.blocks[index + 1]) && block.text === (level.blocks[index + 1] as ParagraphBlock).title);
      const isSummary = (block: Block) => block.type === "paragraph" && block.kind === "summary";
      assert.deepEqual(map.unassignedBlocks, level.blocks.filter((block) => !assigned.has(block) && !duplicateHeadings.includes(block) && !isSummary(block)));
      assert.deepEqual(map.continuousBlocks, level.blocks.filter((block) => !duplicateHeadings.includes(block) && !isSummary(block)));
      assert.equal(map.summary, level.blocks.find(isSummary));
    }
  });

  test(`${surah.surah.no}: next and previous follow passage, ayah and branch order`, () => {
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      const visible = map.groups.flatMap((group) => group.stations.flatMap((station) => station.stops));
      // The level's own stops are numbered along the visible map; its early doors follow them, in the order they were derived.
      assert.deepEqual(map.stops.filter(isOwn), visible.filter(isOwn));
      assert.deepEqual(map.stops.filter((stop) => !isOwn(stop)), visible.filter((stop) => !isOwn(stop)).sort((a, b) => a.blockIndex - b.blockIndex));
      assert.deepEqual(map.stops, [...map.stops.filter(isOwn), ...map.stops.filter((stop) => !isOwn(stop))]);
      map.stops.forEach((stop, index) => {
        assert.equal(stop.number, index + 1);
        const neighbours = stopNeighbours(map, stop.number);
        assert.strictEqual(neighbours.previous, map.stops[index - 1]);
        assert.strictEqual(neighbours.next, map.stops[index + 1]);
      });
      assert.deepEqual(stopNeighbours(map, 0), { previous: undefined, next: undefined });
      assert.deepEqual(stopNeighbours(map, map.stops.length + 1), { previous: undefined, next: undefined });
    }
  });
}

test("93: passages retain content order, correct ranges and explicit stop membership", () => {
  const surah = surahs.find((item) => item.surah.no === 93)!;
  assert.ok(surah.passages?.length);
  for (const level of surah.levels) {
    const map = deriveSurahMap(surah, level.depth);
    assert.deepEqual(map.groups.map((group) => group.passage), surah.passages);
    for (const group of map.groups) {
      const passage = group.passage!;
      const from = Number(passage.from.split(":")[1]);
      const to = Number(passage.to.split(":")[1]);
      assert.deepEqual(group.stations.map((station) => station.ayah.no), Array.from({ length: to - from + 1 }, (_, index) => from + index));
      assert.ok(group.stations.flatMap((station) => station.stops).every((stop) => stop.passage === passage.id));
    }
  }
});

test("matching question headings are suppressed once; plain and different headings remain", () => {
  const surah = surahs.find((item) => item.surah.no === 111)!;
  let matched = false;
  for (const level of surah.levels) {
    for (let index = 0; index + 1 < level.blocks.length; index++) {
      const heading = level.blocks[index], paragraph = level.blocks[index + 1];
      if (heading.type !== "heading" || heading.kind !== "question" || !isTitled(paragraph) || heading.text !== paragraph.title) continue;
      matched = true;
      const map = deriveSurahMap(surah, level.depth);
      assert.ok(!map.continuousBlocks.includes(heading));
      assert.ok(map.continuousBlocks.includes(paragraph));
      const plain: Block = { ...heading, kind: undefined };
      const different: Block = { ...heading, text: surah.surah.name };
      for (const kept of [plain, different]) {
        const copy: Surah = { ...surah, levels: [{ depth: level.depth, blocks: [kept, paragraph] }] };
        assert.deepEqual(deriveSurahMap(copy, level.depth).continuousBlocks, [kept, paragraph]);
      }
    }
  }
  assert.ok(matched, "the real exports exercise the duplicate question rule");
});

test("headings, details and ayah blocks end scenes; leading paragraphs remain unassigned", () => {
  const surah = surahs[0];
  const paragraph = surah.levels[1].blocks.find(isTitled)!;
  const untitled: ParagraphBlock = { ...paragraph, title: undefined };
  const heading = surah.levels[3].blocks.find((block) => block.type === "heading")!;
  const details = surah.levels[3].blocks.find((block) => block.type === "details")!;
  const ayah = surah.levels[1].blocks.find((block) => block.type === "ayah")!;
  const blocks: Block[] = [untitled, paragraph, untitled, heading, untitled, paragraph, details, untitled, paragraph, ayah, untitled];
  const copy: Surah = { ...surah, levels: [{ depth: 1, blocks }] };
  const map = deriveSurahMap(copy, 1);
  assert.deepEqual(map.stops.map((stop) => stop.scene), [[paragraph, untitled], [paragraph], [paragraph]]);
  assert.deepEqual(map.unassignedBlocks, [untitled, heading, untitled, details, untitled, ayah, untitled]);
});

test("an empty level keeps ayah stations and has no stops or neighbours", () => {
  const surah: Surah = { ...surahs[0], levels: [] };
  const map = deriveSurahMap(surah, 1);
  assert.deepEqual(map.stops, []);
  assert.deepEqual(map.continuousBlocks, []);
  assert.deepEqual(map.unassignedBlocks, []);
  assert.equal(map.groups.flatMap((group) => group.stations).length, surah.surah.ayah_count);
});

// The content is rewritten often, so this checks the ordering rule, not which stop happens to be first.
test("93: the opening question is the first titled paragraph in content order", () => {
  const surah = surahs.find((item) => item.surah.no === 93)!;
  const map = deriveSurahMap(surah, 1);
  const pick = (scope: Scope) => heroStop(map.stops, (key) => scopeContains(key, scope, surah.passages), 1);
  const wholeSurah = pick({ kind: "surah" })!;
  assert.equal(wholeSurah.blockIndex, Math.min(...map.stops.map((stop) => stop.blockIndex)));
  const second = surah.passages![1];
  const inSecond = pick({ kind: "passage", id: second.id })!;
  assert.equal(inSecond.passage, second.id);
  assert.equal(inSecond.blockIndex, Math.min(...map.stops.filter((stop) => stop.passage === second.id).map((stop) => stop.blockIndex)));
});

test("an example paragraph joins the scene of the stop before it and adds no record", () => {
  const surah = structuredClone(surahs.find((item) => item.surah.no === 93)!);
  const blocks = surah.levels[1].blocks;
  const at = blocks.findIndex((block) => isTitled(block));
  const example: ParagraphBlock = { type: "paragraph", role: "example", segments: [{ t: "text", v: "x" }] };
  const before = deriveSurahMap(surah, 1);
  blocks.splice(at + 1, 0, example);
  const map = deriveSurahMap(surah, 1);
  assert.equal(map.stops.length, before.stops.length);
  const stop = map.stops.find((item) => item.blockIndex === at)!;
  assert.strictEqual(stop.scene[1], example);
  assert.deepEqual(stop.recordIds, before.stops.find((item) => item.blockIndex === at)!.recordIds.filter((id) => stop.recordIds.includes(id)));
  assert.ok(map.continuousBlocks.includes(example));
});


test("misconception stops retain their kind, station and verified scene without changing content", () => {
  const surah = structuredClone(surahs[0]);
  const blocks = surah.levels[1].blocks;
  const paragraph = blocks.find(isTitled)!;
  paragraph.kind = "misconception";
  paragraph.title = "Common misunderstanding\u061f";
  const snapshot = structuredClone(surah);
  const map = deriveSurahMap(surah, 1);
  const stop = map.stops.find((item) => item.blockIndex === blocks.indexOf(paragraph))!;
  assert.equal(stop.kind, "misconception");
  assert.equal(stop.stationKey, paragraph.ayahs![0]);
  assert.strictEqual(stop.scene[0], paragraph);
  assert.ok(map.groups.some((group) => group.stations.some((station) => station.stops.includes(stop))));
  assert.ok(map.stops.filter((item) => item !== stop).every((item) => item.kind === undefined));
  assert.deepEqual(surah, snapshot);
});

// ---- Early doors: a misconception stop shown, in every shallower level, under the first ayah of the stop ----------

const everyExport: Surah[] = await Promise.all((JSON.parse(await readFile(new URL("../../../content/export/index.json", import.meta.url), "utf8")) as { surahs: { no: number }[] })
  .surahs.map(async ({ no }) => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8")) as Surah));
/** The misconception stops as the exporter wrote them: read from the blocks, not from the map under test. */
const originsOf = (surah: Surah) => surah.levels.flatMap((level) => level.blocks.flatMap((block, index) =>
  isTitled(block) && block.kind === "misconception" ? [{ depth: level.depth, index, block }] : []));
const doorsOf = (map: SurahMapModel) => map.stops.filter((stop) => !isOwn(stop));
/** The map as its level draws it without the early doors. */
const withoutDoors = (map: SurahMapModel): SurahMapModel => ({
  ...map, stops: map.stops.filter(isOwn),
  groups: map.groups.map((group) => ({ ...group, stations: group.stations.map((station) => ({ ...station, stops: station.stops.filter(isOwn) })) })),
});
/** The level drawn on its own: with no deeper level, no early door can come from one. */
const alone = (surah: Surah, depth: Depth): SurahMapModel => deriveSurahMap({ ...surah, levels: surah.levels.filter((level) => level.depth === depth) }, depth);
/** What makes two stops the same door: one station and one title, spaces unified. */
const nameOf = (stop: { stationKey: string; title: string }) => `${stop.stationKey}|${stop.title.replace(/\s+/g, " ").trim()}`;
const originName = (block: ParagraphBlock) => nameOf({ stationKey: block.ayahs![0], title: block.title! });

test("the real exports carry misconception stops and surahs without them, so the early door tests are not empty", () => {
  assert.ok(everyExport.some((surah) => originsOf(surah).length > 0));
  assert.ok(everyExport.some((surah) => originsOf(surah).length === 0));
});

test("an early door appears in each shallower level, under the first ayah of its stop and in its passage", () => {
  let checked = 0;
  for (const surah of everyExport) {
    const origins = originsOf(surah).sort((a, b) => a.depth - b.depth || a.index - b.index);
    for (const origin of origins) {
      const name = originName(origin.block);
      // The same stop at several levels gives one door, from the nearest level that has it.
      if (origins.find((other) => originName(other.block) === name) !== origin) continue;
      for (const level of surah.levels.filter((item) => item.depth < origin.depth)) {
        const map = deriveSurahMap(surah, level.depth);
        if (!map.stops.some(isOwn)) continue;
        const doors = doorsOf(map).filter((stop) => nameOf(stop) === name);
        if (map.stops.some((stop) => isOwn(stop) && nameOf(stop) === name)) {
          assert.equal(doors.length, 0, `${surah.surah.no} depth ${level.depth}: the level already has this stop`);
          continue;
        }
        assert.equal(doors.length, 1, `${surah.surah.no} depth ${level.depth}: one door for ${origin.block.title}`);
        const [door] = doors;
        assert.equal(door.fromDepth, origin.depth);
        assert.equal(door.kind, "misconception");
        assert.deepEqual(door.ayahKeys, origin.block.ayahs);
        assert.equal(door.stationKey, origin.block.ayahs![0]);
        assert.equal(door.passage, origin.block.passage);
        const group = map.groups.find((item) => item.passage?.id === origin.block.passage)!;
        const station = group.stations.find((item) => item.ayah.key === door.stationKey)!;
        assert.ok(station.stops.includes(door), "the door hangs under its ayah, in its passage");
        assert.ok(map.stops.includes(door), "the door is one of the level's stops, so it opens");
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});

test("an early door is not in its own level or a deeper one, and its own level shows the stop once", () => {
  for (const surah of everyExport) {
    const origins = originsOf(surah);
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      for (const door of doorsOf(map)) assert.ok(door.fromDepth! > level.depth, `${surah.surah.no}: a door at depth ${level.depth} comes from a deeper level`);
      const keys = doorsOf(map).map((door) => `${door.stationKey}|${door.title}`);
      assert.equal(new Set(keys).size, keys.length, "no door twice in a level");
      for (const origin of origins) {
        if (level.depth >= origin.depth) assert.ok(!doorsOf(map).some((door) => door.fromDepth === origin.depth && nameOf(door) === originName(origin.block)));
        // Its own level has the stop and nothing else of that name: no door repeats it.
        if (level.depth === origin.depth) assert.ok(map.stops.filter((stop) => nameOf(stop) === originName(origin.block)).every(isOwn));
      }
    }
  }
});

test("an early door opens the scene, records and icons of its own level, unchanged", () => {
  let checked = 0;
  for (const surah of everyExport) {
    const snapshot = structuredClone(surah);
    for (const origin of originsOf(surah)) {
      const home = deriveSurahMap(surah, origin.depth).stops.find((stop) => stop.blockIndex === origin.index)!;
      assert.strictEqual(home.scene[0], origin.block);
      for (const level of surah.levels.filter((item) => item.depth < origin.depth)) {
        const door = deriveSurahMap(surah, level.depth).stops.find((stop) => stop.fromDepth === origin.depth && stop.title === origin.block.title);
        if (!door) continue;
        assert.equal(door.scene.length, home.scene.length);
        door.scene.forEach((block, index) => assert.strictEqual(block, home.scene[index], "the very blocks of the stop's own level"));
        assert.deepEqual(door.recordIds, home.recordIds);
        assert.deepEqual(door.icons, home.icons);
        assert.ok(door.recordIds.every((id) => Object.hasOwn(surah.records, id)));
        assert.notStrictEqual(door.scene, home.scene, "its own list, so changing one never changes the other");
        checked++;
      }
    }
    assert.deepEqual(surah, snapshot, "deriving the map changes no content");
  }
  assert.ok(checked > 0);
});

test("a surah without the mark draws exactly what each level draws alone; a marked one only gains doors", () => {
  for (const surah of everyExport) {
    const marked = originsOf(surah).length > 0;
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      if (marked) assert.deepEqual(withoutDoors(map), alone(surah, level.depth), `${surah.surah.no} depth ${level.depth}: its own stops, numbers and text are as before`);
      else {
        assert.deepEqual(map, alone(surah, level.depth), `${surah.surah.no} depth ${level.depth}: nothing changes`);
        assert.equal(doorsOf(map).length, 0);
      }
    }
  }
});

test("every stop of a level has a whole block index of its own, and doors are numbered after the level's own stops", () => {
  for (const surah of everyExport) for (const level of surah.levels) {
    const map = deriveSurahMap(surah, level.depth);
    assert.ok(map.stops.every((stop) => Number.isInteger(stop.blockIndex)));
    assert.equal(new Set(map.stops.map((stop) => stop.blockIndex)).size, map.stops.length);
    assert.deepEqual(map.stops.map((stop) => stop.number), map.stops.map((_, index) => index + 1));
    const own = map.stops.filter(isOwn);
    assert.deepEqual(map.stops.slice(0, own.length), own);
    for (const door of doorsOf(map)) assert.ok(own.every((stop) => door.blockIndex > stop.blockIndex), "a door's index is past every stop's");
  }
});

test("an early door never opens a unit: the opening question is a stop of the level itself", () => {
  let doors = 0;
  for (const surah of everyExport) for (const level of surah.levels) {
    const map = deriveSurahMap(surah, level.depth);
    const whole = heroStop(map.stops, () => true, 1);
    if (whole) assert.ok(isOwn(whole));
    for (const door of doorsOf(map)) {
      const here = heroStop(map.stops, (key) => key === door.stationKey, Number(door.stationKey.split(":")[1]));
      if (here) assert.ok(isOwn(here));
      doors++;
    }
  }
  assert.ok(doors > 0);
});

test("deriveEarlyMisconceptions changes no content and names the doors the map places", () => {
  for (const surah of everyExport) {
    const snapshot = structuredClone(surah);
    for (const level of surah.levels) {
      const placed = doorsOf(deriveSurahMap(surah, level.depth)).map((door) => ({ ...door, number: 0 }));
      assert.deepEqual(deriveEarlyMisconceptions(surah, level.depth), placed);
    }
    assert.deepEqual(surah, snapshot);
  }
});

// Test fixtures, not content: invented words and ids that exist in no export, and no Quran text.
const fxRecord = (id: string, icons: IconKey[]): SourceRecord => ({ id, icons, badge: null, claim: "fixture claim", status_text: "", depth_min: 0, ayah_keys: [], evidence: [] });
const fxText = (records: string[] = ["fx-r1"]): ParagraphBlock => ({ type: "paragraph", role: "claim", segments: [{ t: "text", v: "fixture sentence" }, { t: "mark", records }] });
const fxStop = (title: string, ayah: string, records?: string[], extra: Partial<ParagraphBlock> = {}): ParagraphBlock => ({ ...fxText(records), title, ayahs: [ayah], ...extra });
const fxWrong = (title: string, ayah: string, records?: string[]) => fxStop(title, ayah, records, { kind: "misconception" });
const fxSummary = (): ParagraphBlock => ({ ...fxText(), kind: "summary" });
const fxQuestion = (name: string) => `Fixture ${name}\u061f`;
function fxSurah(levels: Partial<Record<Depth, Block[]>>): Surah {
  return {
    schema: 1, fixture: true, surah: { no: 1, name: "Fixture", ayah_count: 3 },
    ayahs: [1, 2, 3].map((no) => ({ key: `1:${no}`, no, text: `fixture ayah ${no}` })),
    levels: ([0, 1, 2, 3] as const).map((depth) => ({ depth, blocks: levels[depth] ?? [] })),
    records: { "fx-r1": fxRecord("fx-r1", ["scholar"]), "fx-r2": fxRecord("fx-r2", ["hadith", "ayah"]) },
  };
}
const titlesAt = (map: SurahMapModel, key: string) => map.groups[0].stations.find((station) => station.ayah.key === key)!.stops.map((stop) => stop.title);

test("fixture: a door follows the stops of its station, is numbered after the level's own stops and takes block indexes past its blocks", () => {
  const closing = [fxStop(fxQuestion("A"), "1:1"), fxText(), fxStop(fxQuestion("B"), "1:3")];
  const deeper = [fxWrong(fxQuestion("X1"), "1:1", ["fx-r2"]), fxStop(fxQuestion("Y"), "1:2"), fxWrong(fxQuestion("X2"), "1:3"), fxText()];
  const surah = fxSurah({ 0: [...closing, fxSummary()], 1: deeper });
  const map = deriveSurahMap(surah, 0);
  assert.deepEqual(titlesAt(map, "1:1"), [fxQuestion("A"), fxQuestion("X1")]);
  assert.deepEqual(titlesAt(map, "1:2"), []);
  assert.deepEqual(titlesAt(map, "1:3"), [fxQuestion("B"), fxQuestion("X2")]);
  assert.deepEqual(map.stops.map((stop) => [stop.number, stop.title]), [[1, fxQuestion("A")], [2, fxQuestion("B")], [3, fxQuestion("X1")], [4, fxQuestion("X2")]]);
  const [first, second] = doorsOf(map);
  assert.deepEqual([first.blockIndex, second.blockIndex], [3, 4], "past the last block that is not the closing summary");
  assert.deepEqual(doorsOf(deriveSurahMap(fxSurah({ 0: closing, 1: deeper }), 0)).map((door) => door.blockIndex), [3, 4], "the closing summary moves nothing");
  assert.strictEqual(first.scene[0], deeper[0]);
  assert.deepEqual(first.recordIds, ["fx-r2"]);
  assert.deepEqual(first.icons, ["ayah", "hadith"], "the icons come in the legend's order");
  assert.deepEqual([first.fromDepth, second.fromDepth], [1, 1]);
  // The level that owns the stops keeps its own two doors and has no early one.
  assert.deepEqual(deriveSurahMap(surah, 1).stops.map((stop) => [stop.number, stop.fromDepth]), [[1, undefined], [2, undefined], [3, undefined]]);
});

test("fixture: a level without a stop of its own gets no early door", () => {
  const surah = fxSurah({ 0: [fxText(), fxSummary()], 1: [fxWrong(fxQuestion("X"), "1:1")] });
  assert.deepEqual(deriveEarlyMisconceptions(surah, 0), []);
  const map = deriveSurahMap(surah, 0);
  assert.deepEqual(map.stops, []);
  assert.ok(map.groups.every((group) => group.stations.every((station) => station.stops.length === 0)));
  assert.equal(map.unassignedBlocks.length, 1);
});

test("fixture: a stop that appears in several levels gives one door, from the nearest level, and none where the level has it", () => {
  const surah = fxSurah({
    0: [fxStop(fxQuestion("Same"), "1:1")],
    1: [fxWrong(fxQuestion("Same"), "1:1"), fxWrong(fxQuestion("Shared"), "1:2")],
    2: [fxWrong("Fixture  Shared\u061f", "1:2"), fxWrong(fxQuestion("Other"), "1:3")],
  });
  const shallow = doorsOf(deriveSurahMap(surah, 0));
  assert.deepEqual(shallow.map((door) => [door.title, door.fromDepth]), [[fxQuestion("Shared"), 1], [fxQuestion("Other"), 2]]);
  assert.deepEqual(doorsOf(deriveSurahMap(surah, 1)).map((door) => [door.title, door.fromDepth]), [[fxQuestion("Other"), 2]]);
  assert.deepEqual(doorsOf(deriveSurahMap(surah, 2)), []);
});

test("fixture: a stop of a deeper level shows in every shallower level that has stops, and in none from its own down", () => {
  const surah = fxSurah({
    0: [fxStop(fxQuestion("A"), "1:1")], 1: [fxStop(fxQuestion("B"), "1:2")],
    2: [fxWrong(fxQuestion("Z"), "1:3")], 3: [fxText()],
  });
  assert.deepEqual([0, 1, 2, 3].map((depth) => doorsOf(deriveSurahMap(surah, depth as Depth)).map((door) => door.fromDepth)), [[2], [2], [], []]);
  assert.deepEqual(deriveSurahMap(surah, 2).stops.map((stop) => [stop.title, stop.kind]), [[fxQuestion("Z"), "misconception"]]);
});

test("fixture: an early door is never the opening question, even when its station is the only one in scope", () => {
  const surah = fxSurah({ 0: [fxStop(fxQuestion("A"), "1:1")], 1: [fxWrong(fxQuestion("X"), "1:3")] });
  const map = deriveSurahMap(surah, 0);
  assert.equal(doorsOf(map).length, 1);
  assert.equal(heroStop(map.stops, () => true, 1)!.title, fxQuestion("A"));
  assert.equal(heroStop(map.stops, (key) => key === "1:3", 3), undefined);
  assert.equal(heroStop(doorsOf(map), () => true, 1), undefined);
});

test("fixture: a stop whose ayah is not the surah's own leaves no door on the map and takes no number", () => {
  const surah = fxSurah({ 0: [fxStop(fxQuestion("A"), "1:1")], 1: [fxWrong(fxQuestion("Far"), "2:1"), fxWrong(fxQuestion("Near"), "1:2")] });
  assert.equal(deriveEarlyMisconceptions(surah, 0).length, 2);
  assert.deepEqual(deriveSurahMap(surah, 0).stops.map((stop) => [stop.number, stop.title]), [[1, fxQuestion("A")], [2, fxQuestion("Near")]]);
});

test("a real export with one stop marked in memory shows that stop as a door in the level above, and changes nothing else", () => {
  const surah = structuredClone(surahs[0]);
  const paragraph = surah.levels[1].blocks.find(isTitled)!;
  paragraph.kind = "misconception";
  const snapshot = structuredClone(surah);
  const map = deriveSurahMap(surah, 0);
  const door = doorsOf(map).find((item) => item.title === paragraph.title)!;
  assert.ok(door);
  assert.strictEqual(door.scene[0], paragraph);
  assert.equal(door.fromDepth, 1);
  assert.deepEqual(withoutDoors(map), alone(surah, 0), "the level's own stops, numbers and text are as they were");
  assert.deepEqual(surah, snapshot);
});
