import type { Block, Depth, ParagraphBlock, Surah, TitleSegment } from "./types";

/** A deeper stop of the surah, as `deriveSurahMap` makes it. Only what a follow-up needs. */
export interface StopLike { blockIndex: number; title: string; ayahKeys: string[]; scene: ParagraphBlock[] }
/** A question that goes deeper than the stop the reader is on: a stop of a deeper level, or a depth item (`details`) of one. */
export interface Followup {
  /** `depth:blockIndex`, stable while the content is. */
  id: string;
  depth: Depth;
  kind: "stop" | "detail";
  title: TitleSegment[];
  blocks: ParagraphBlock[];
}
/** The most a stop offers. */
export const maxFollowups = 5;

const flat = (title: TitleSegment[]) => title.map((segment) => segment.t === "text" || segment.t === "term" ? segment.v : "").join("").replace(/\s+/g, " ").trim();

/**
 * Every deeper question that shares at least one ayah with the stop and is titled differently, by depth and then by its order in the content.
 * A depth item carries no ayah tag of its own: its ayahs are those of the records its title cites, which is also what places its pin on the map.
 * `stopsByDepth[d]` are the titled stops of level `d` (an empty list where the level has none). No model and no text of its own.
 */
export function deriveFollowups(surah: Surah, depth: Depth, unit: { title: string; ayahKeys: string[] }, stopsByDepth: StopLike[][]): Followup[] {
  const own = new Set(unit.ayahKeys);
  const title = unit.title.replace(/\s+/g, " ").trim();
  const found: Followup[] = [];
  for (const level of surah.levels) {
    if (level.depth <= depth) continue;
    const here: (Followup & { order: number })[] = [];
    for (const stop of stopsByDepth[level.depth] ?? []) {
      if (stop.title.replace(/\s+/g, " ").trim() === title || !stop.ayahKeys.some((key) => own.has(key))) continue;
      here.push({ id: `${level.depth}:${stop.blockIndex}`, depth: level.depth, kind: "stop", title: [{ t: "text", v: stop.title }], blocks: stop.scene, order: stop.blockIndex });
    }
    level.blocks.forEach((block: Block, index) => {
      if (block.type !== "details" || flat(block.title) === title) return;
      const keys = block.title.flatMap((segment) => segment.t === "mark" ? segment.records.flatMap((id) => surah.records[id]?.ayah_keys ?? []) : []);
      if (!keys.some((key) => own.has(key))) return;
      here.push({ id: `${level.depth}:${index}`, depth: level.depth, kind: "detail", title: block.title, blocks: block.blocks, order: index });
    });
    found.push(...here.sort((a, b) => a.order - b.order).map(({ order: _order, ...item }) => item));
  }
  return found;
}
/**
 * What a stop shows: the promoted ones (ids the caller names, in its order; unknown ids are ignored) first, then the rest in their order, five at most together.
 * Promoted ones come from the whole candidate list, so a promoted question is shown even when five others rank before it.
 */
export function arrangeFollowups(all: Followup[], promoted: string[] = []): { promoted: Followup[]; rest: Followup[] } {
  const byId = new Map(all.map((item) => [item.id, item]));
  const first = [...new Set(promoted)].flatMap((id) => byId.get(id) ?? []).slice(0, maxFollowups);
  const taken = new Set(first.map((item) => item.id));
  return { promoted: first, rest: all.filter((item) => !taken.has(item.id)).slice(0, maxFollowups - first.length) };
}
