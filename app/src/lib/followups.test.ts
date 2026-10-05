import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { arrangeFollowups, deriveFollowups, maxFollowups } from "./followups.ts";
// @ts-expect-error -- Node 24 requires the source extension; no files are emitted.
import { deriveSurahMap } from "./map.ts";
import type { Depth, Surah } from "./types";
import type { Followup } from "./followups";

const load = async (no: number): Promise<Surah> => JSON.parse(await readFile(new URL(`../../../content/export/surah-${no}.json`, import.meta.url), "utf8"));
const depths = [0, 1, 2, 3] as const;
const stopsOf = (surah: Surah) => depths.map((depth) => deriveSurahMap(surah, depth).stops);
const shared = (surah: Surah, depth: Depth, index: number) => {
  const stop = deriveSurahMap(surah, depth).stops[index];
  return deriveFollowups(surah, depth, stop, stopsOf(surah)) as Followup[];
};

test("a stop's follow-ups come from deeper levels only, share an ayah, and are titled differently", async () => {
  const surah = await load(93);
  const maps = ([0, 1, 2, 3] as const).map((depth) => deriveSurahMap(surah, depth));
  for (const depth of [0, 1, 2] as const) {
    maps[depth].stops.forEach((stop, index) => {
      const items = shared(surah, depth, index);
      const own = new Set(stop.ayahKeys);
      for (const item of items) {
        assert.ok(item.depth > depth, `${item.id} is deeper than ${depth}`);
        const flat = item.title.map((segment) => segment.t === "text" || segment.t === "term" ? segment.v : "").join("").replace(/\s+/g, " ").trim();
        assert.notEqual(flat, stop.title.trim());
        const keys = item.kind === "stop"
          ? maps[item.depth].stops.find((candidate) => `${item.depth}:${candidate.blockIndex}` === item.id)!.ayahKeys
          : item.title.flatMap((segment) => segment.t === "mark" ? segment.records.flatMap((id) => surah.records[id].ayah_keys) : []);
        assert.ok(keys.some((key) => own.has(key)), `${item.id} shares an ayah with ${stop.title}`);
      }
      assert.deepEqual(items.map((item) => item.depth), [...items.map((item) => item.depth)].sort(), "ordered by depth");
    });
  }
});
test("a stop of the same title at a deeper level is not offered", async () => {
  const surah = await load(93);
  const first = deriveSurahMap(surah, 1).stops.find((stop) => stop.title === "الموقف الذي نزلت فيه")!;
  const items = deriveFollowups(surah, 1, first, stopsOf(surah)) as Followup[];
  assert.ok(items.length > 0);
  assert.ok(!items.some((item) => item.kind === "stop" && item.title[0].t === "text" && item.title[0].v === first.title));
});
test("the deepest level offers none, and ids are depth:block", async () => {
  const surah = await load(93);
  const pin = { title: "x", ayahKeys: ["93:3"] };
  assert.deepEqual(deriveFollowups(surah, 3, pin, stopsOf(surah)), []);
  for (const item of deriveFollowups(surah, 0, pin, stopsOf(surah)) as Followup[]) assert.match(item.id, /^[123]:\d+$/);
  const details = (deriveFollowups(surah, 2, { title: "x", ayahKeys: ["93:3"] }, stopsOf(surah)) as Followup[]).filter((item) => item.kind === "detail");
  assert.ok(details.length > 0);
  for (const item of details) {
    const block = surah.levels[3].blocks[Number(item.id.split(":")[1])];
    assert.equal(block.type, "details");
    assert.equal(item.blocks, (block as { blocks: unknown }).blocks);
  }
});
test("a stop with no shared ayah gets nothing", async () => {
  const surah = await load(93);
  assert.deepEqual(deriveFollowups(surah, 1, { title: "x", ayahKeys: ["1:1"] }, stopsOf(surah)), []);
});
const item = (id: string): Followup => ({ id, depth: 2, kind: "stop", title: [{ t: "text", v: id }], blocks: [] });
test("arranging keeps five at most and the order of the content", () => {
  const all = ["2:1", "2:2", "2:3", "3:1", "3:2", "3:3", "3:4"].map(item);
  assert.deepEqual(arrangeFollowups(all).promoted, []);
  assert.deepEqual(arrangeFollowups(all).rest.map((entry) => entry.id), ["2:1", "2:2", "2:3", "3:1", "3:2"]);
  assert.equal(maxFollowups, 5);
});
test("promoted ids come first in the caller's order, from the whole list, and unknown ids are ignored", () => {
  const all = ["2:1", "2:2", "2:3", "3:1", "3:2", "3:3", "3:4"].map(item);
  const arranged = arrangeFollowups(all, ["3:4", "9:9", "2:2", "3:4"]);
  assert.deepEqual(arranged.promoted.map((entry) => entry.id), ["3:4", "2:2"]);
  assert.deepEqual(arranged.rest.map((entry) => entry.id), ["2:1", "2:3", "3:1"]);
  assert.equal(arranged.promoted.length + arranged.rest.length, 5);
  assert.deepEqual(arrangeFollowups(all, ["9:9"]).promoted, []);
  assert.deepEqual(arrangeFollowups([], ["2:1"]), { promoted: [], rest: [] });
});
