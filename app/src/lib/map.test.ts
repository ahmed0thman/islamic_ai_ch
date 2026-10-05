import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveSurahMap, heroStop, stopNeighbours } from "./map.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { scopeContains, type Scope } from "./scope.ts";
import type { Block, ParagraphBlock, Surah } from "./types";

const surahs: Surah[] = await Promise.all([108, 93, 111].map(async (no) =>
  JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8")),
));
const isTitled = (block: Block | undefined): block is ParagraphBlock & { title: string } => block?.type === "paragraph" && Boolean(block.title);

for (const surah of surahs) {
  test(`${surah.surah.no}: every titled paragraph becomes exactly one stop without mutating content`, () => {
    const snapshot = structuredClone(surah);
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth);
      const titled = level.blocks.filter(isTitled);
      assert.equal(map.stops.length, titled.length);
      assert.equal(new Set(map.stops.map((stop) => stop.blockIndex)).size, titled.length);
      assert.deepEqual(map.stops.map((stop) => stop.blockIndex).sort((a, b) => a - b),
        level.blocks.flatMap((block, index) => isTitled(block) ? [index] : []));
      for (const stop of map.stops) {
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
          assert.deepEqual(station.stops.map((stop) => stop.scene[0]), expected);
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
      for (const stop of map.stops) {
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
      assert.deepEqual(map.stops, map.groups.flatMap((group) => group.stations.flatMap((station) => station.stops)));
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
