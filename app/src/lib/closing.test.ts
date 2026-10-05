import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { closingParts, lastStop } from "./closing.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveSurahMap, stopNeighbours } from "./map.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveDepthItems } from "./depth-items.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { relationRecords } from "./relations.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveAtoms } from "./ask/atoms.ts";
import type { Block, ParagraphBlock, Passage, Surah } from "./types";

const load = async (no: number): Promise<Surah> => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"));
const isSummary = (block: Block) => block.type === "paragraph" && block.kind === "summary";
/** The export as it is, with a closing summary at the end of every level: a copy of that level's last claim paragraph, stripped of what a summary never has. */
function withSummaries(source: Surah): Surah {
  const surah = structuredClone(source);
  for (const level of surah.levels) {
    level.blocks = level.blocks.filter((block) => !isSummary(block));
    const claim = [...level.blocks].reverse().find((block): block is ParagraphBlock => block.type === "paragraph" && block.role === "claim" && !block.title)
      ?? level.blocks.find((block): block is ParagraphBlock => block.type === "paragraph" && block.role === "claim")!;
    const summary: ParagraphBlock = structuredClone(claim);
    delete summary.title; delete summary.ayahs;
    summary.kind = "summary";
    level.blocks.push(summary);
  }
  return surah;
}

for (const no of [93, 108]) {
  const base = await load(no);
  const plain = structuredClone(base);
  for (const level of plain.levels) level.blocks = level.blocks.filter((block) => !isSummary(block));
  const surah = withSummaries(base);

  test(`${no}: a summary is never a stop, never part of a stop's scene and never in the continuous blocks`, () => {
    const snapshot = structuredClone(surah);
    for (const level of surah.levels) {
      const map = deriveSurahMap(surah, level.depth), without = deriveSurahMap(plain, level.depth);
      const last = level.blocks.at(-1)!;
      assert.strictEqual(map.summary, last);
      assert.equal(without.summary, undefined);
      assert.deepEqual(map.stops.map((stop) => [stop.number, stop.blockIndex, stop.title]), without.stops.map((stop) => [stop.number, stop.blockIndex, stop.title]));
      assert.deepEqual(map.stops.map((stop) => stop.scene.length), without.stops.map((stop) => stop.scene.length));
      assert.ok(map.stops.every((stop) => !stop.scene.includes(last as ParagraphBlock)));
      assert.ok(!map.continuousBlocks.includes(last));
      assert.ok(!map.unassignedBlocks.includes(last));
      assert.equal(map.continuousBlocks.length, without.continuousBlocks.length);
      assert.equal(map.unassignedBlocks.length, without.unassignedBlocks.length);
      if (map.stops.length) assert.equal(stopNeighbours(map, map.stops.length).next, undefined);
    }
    assert.deepEqual(surah, snapshot);
  });

  test(`${no}: a summary is never a depth-item section, a pin or a shelf door`, () => {
    for (const level of surah.levels) {
      const model = deriveDepthItems(surah, level.depth), without = deriveDepthItems(plain, level.depth);
      const last = level.blocks.at(-1) as ParagraphBlock;
      assert.deepEqual(model.units.map((unit) => [unit.kind, unit.title, unit.number]), without.units.map((unit) => [unit.kind, unit.title, unit.number]));
      assert.ok(model.units.every((unit) => !unit.scene.includes(last)));
    }
  });

  test(`${no}: relations and ask atoms read a summary as an ordinary claim without breaking`, () => {
    for (const level of surah.levels) assert.ok(Array.isArray(relationRecords(surah, level.depth)));
    const atoms = deriveAtoms(surah);
    assert.ok(atoms.length > 0);
    assert.equal(new Set(atoms.map((atom: { id: string }) => atom.id)).size, atoms.length);
    for (const atom of atoms) assert.ok(atom.records.every((id: string) => Object.hasOwn(surah.records, id)));
  });
}

const passage = (id: string): Passage => ({ id, from: "1:1", to: "1:2", title: id, records: [] });
test("parts follow the passages in order and each points at its first stop in reading order", () => {
  const units = [{ blockIndex: 5, passage: "b", n: 1 }, { blockIndex: 2, passage: "b", n: 2 }, { blockIndex: 1, passage: "a", n: 3 }];
  const parts = closingParts([passage("a"), passage("b"), passage("c")], units);
  assert.deepEqual(parts.map((part: { passage: Passage }) => part.passage.id), ["a", "b", "c"]);
  assert.deepEqual(parts.map((part: { unit?: { n: number } }) => part.unit?.n), [3, 2, undefined]);
  assert.deepEqual(closingParts(undefined, units), []);
});
test("the stop before the closing screen is the last one by block, whatever order the list is in", () => {
  assert.equal(lastStop([{ blockIndex: 4 }, { blockIndex: 9 }, { blockIndex: 1 }])?.blockIndex, 9);
  assert.equal(lastStop([]), undefined);
});
