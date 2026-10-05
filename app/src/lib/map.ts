import type { Ayah, Block, Depth, IconKey, ParagraphBlock, Passage, Surah } from "./types";

export interface MapStop {
  /** One-based position along the visible map, also used in the URL. An early door is numbered after the level's own stops, so no number a reader may already hold changes. */
  number: number;
  /** Position in the level's blocks. An early door has none here: its index is a whole number past the last block that is not the closing summary, so it never meets a stop's and no two doors share one. */
  blockIndex: number;
  title: string;
  kind?: "misconception";
  ayahKeys: string[];
  stationKey: string;
  passage?: string;
  scene: ParagraphBlock[];
  recordIds: string[];
  icons: IconKey[];
  /** Only on an early door (a misconception stop of a deeper level, shown on this one): the level it belongs to. Its scene and records are that stop's own, unchanged. */
  fromDepth?: Depth;
}
export interface MapStation { ayah: Ayah; stops: MapStop[] }
export interface MapGroup { passage?: Passage; stations: MapStation[] }
export interface SurahMapModel {
  /** The closing synthesis of the level, when it has one. It is never a stop, a scene paragraph or part of the continuous blocks: the closing screen shows it. */
  summary?: ParagraphBlock;
  groups: MapGroup[];
  /** The level's own stops in visible order, then its early doors; `number` is the position here. */
  stops: MapStop[];
  continuousBlocks: Block[];
  unassignedBlocks: Block[];
}

/** Beads and ayah nodes need about 1.5rem and a row each; past this many ayahs a surah is long: its strip shows rails alone and its thread opens on the passage outline. */
export const longSurahAyahs = 12;
export const isLongSurah = (ayahCount: number) => ayahCount > longSurahAyahs;

const iconOrder: IconKey[] = ["ayah", "hadith", "athar", "scholar", "link", "hidaya"];

/** Only a matching question immediately before its titled answer is redundant. */
function isDuplicateQuestion(block: Block, next: Block | undefined): boolean {
  return block.type === "heading" && block.kind === "question"
    && next?.type === "paragraph" && block.text === next.title;
}

/** The titled paragraphs of one level as stops, each with its scene and its records, before they are placed on the map. */
function collectStops(surah: Surah, blocks: Block[]): { stops: MapStop[]; unassignedBlocks: Block[]; summary?: ParagraphBlock } {
  const stops: MapStop[] = [];
  const unassignedBlocks: Block[] = [];
  let current: MapStop | undefined;
  let summary: ParagraphBlock | undefined;

  blocks.forEach((block, blockIndex) => {
    if (block.type === "paragraph" && block.kind === "summary") {
      // It closes the level; it never joins the scene of the stop before it.
      summary = block;
      current = undefined;
    } else if (block.type === "paragraph" && block.title) {
      current = {
        number: 0, blockIndex, title: block.title, ayahKeys: [...block.ayahs!],
        stationKey: block.ayahs![0], passage: block.passage,
        ...(block.kind === "misconception" ? { kind: block.kind } : {}),
        scene: [block], recordIds: [], icons: [],
      };
      stops.push(current);
    } else if (block.type === "paragraph" && current) {
      current.scene.push(block);
    } else {
      current = undefined;
      if (!isDuplicateQuestion(block, blocks[blockIndex + 1])) unassignedBlocks.push(block);
    }
  });

  for (const stop of stops) {
    const ids = new Set<string>();
    for (const paragraph of stop.scene) {
      for (const segment of paragraph.segments) {
        if (segment.t === "mark") segment.records.forEach((id) => ids.add(id));
        else if (segment.t === "quote" || segment.t === "term") ids.add(segment.record);
      }
    }
    stop.recordIds = [...ids];
    stop.icons = iconOrder.filter((icon) => stop.recordIds.some((id) => surah.records[id].icons.includes(icon)));
  }
  return { stops, unassignedBlocks, summary };
}

/** The same door at two levels: one station and one title, spaces unified. */
const sameDoor = (stop: { stationKey: string; title: string }) => `${stop.stationKey}\n${stop.title.replace(/\s+/g, " ").trim()}`;

/** Where an early door's `blockIndex` starts: one past the last block that is not the closing summary. A summary is never a stop, so adding or dropping it never moves a door. */
const doorBase = (blocks: Block[]) => blocks.reduce((next, block, index) => block.type === "paragraph" && block.kind === "summary" ? next : index + 1, 0);

/**
 * A common-misconception stop is a side path that returns to the reading (decision 027), and it is to appear early (decision 078).
 * So every level shallower than the stop's own shows one door for it, under its first ayah, with the stop's own scene and records.
 * A door is a copy of the stop with three fields of its own: `fromDepth`, a `blockIndex` past the level's blocks (`doorBase`) and a `number` that `deriveSurahMap` gives it after the level's own stops.
 * The level that owns the stop, and every deeper one, has none. A door that repeats a stop of the level (same station and title) or a nearer level's door is skipped.
 * A level without a stop of its own is walked through its depth items, and a door would replace them, so it gets none.
 */
function earlyDoors(surah: Surah, depth: Depth, own: MapStop[], base: number): MapStop[] {
  if (!own.length) return [];
  const taken = new Set(own.map(sameDoor));
  const doors: MapStop[] = [];
  for (const level of [...surah.levels].sort((a, b) => a.depth - b.depth)) {
    if (level.depth <= depth) continue;
    for (const origin of collectStops(surah, level.blocks).stops) {
      if (origin.kind !== "misconception" || taken.has(sameDoor(origin))) continue;
      taken.add(sameDoor(origin));
      doors.push({
        ...origin, number: 0, blockIndex: base + doors.length, fromDepth: level.depth,
        ayahKeys: [...origin.ayahKeys], scene: [...origin.scene], recordIds: [...origin.recordIds], icons: [...origin.icons],
      });
    }
  }
  return doors;
}

/** The early doors a level shows, not yet placed on its map (`number` 0). Content is never changed. */
export function deriveEarlyMisconceptions(surah: Surah, depth: Depth): MapStop[] {
  const blocks = surah.levels.find((level) => level.depth === depth)?.blocks ?? [];
  return earlyDoors(surah, depth, collectStops(surah, blocks).stops, doorBase(blocks));
}

/** Derive the map without changing any content, paragraph, segment or record. */
export function deriveSurahMap(surah: Surah, depth: Depth): SurahMapModel {
  const blocks = surah.levels.find((level) => level.depth === depth)?.blocks ?? [];
  const { stops, unassignedBlocks, summary } = collectStops(surah, blocks);
  const early = earlyDoors(surah, depth, stops, doorBase(blocks));
  const placeable = [...stops, ...early];

  const ownAyahs = surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`))
    .sort((a, b) => a.no - b.no);
  const passages: (Passage | undefined)[] = surah.passages?.length ? surah.passages : [undefined];
  const groups = passages.map((passage): MapGroup => {
    const from = passage ? Number(passage.from.split(":")[1]) : 1;
    const to = passage ? Number(passage.to.split(":")[1]) : surah.surah.ayah_count;
    return {
      passage,
      stations: ownAyahs.filter((ayah) => ayah.no >= from && ayah.no <= to).map((ayah) => ({
        ayah,
        stops: placeable.filter((stop) => stop.stationKey === ayah.key && stop.passage === passage?.id),
      })),
    };
  });
  const visible = groups.flatMap((group) => group.stations.flatMap((station) => station.stops));
  // The level's own stops are numbered along the visible map, as they always were; the early doors follow them.
  const ordered = [...visible.filter((stop) => stop.fromDepth === undefined), ...early.filter((stop) => visible.includes(stop))];
  ordered.forEach((stop, index) => { stop.number = index + 1; });
  return {
    summary, groups, stops: ordered, unassignedBlocks,
    continuousBlocks: blocks.filter((block, index) => !(block.type === "paragraph" && block.kind === "summary") && !isDuplicateQuestion(block, blocks[index + 1])),
  };
}

export function stopNeighbours(map: SurahMapModel, number: number) {
  const index = map.stops.findIndex((stop) => stop.number === number);
  return {
    previous: index > 0 ? map.stops[index - 1] : undefined,
    next: index >= 0 ? map.stops[index + 1] : undefined,
  };
}

/**
 * The question that opens a unit: the first titled paragraph in content order inside the scope, not the first
 * ayah on the thread. A weaving puts its opening question first in the blocks even when its ayah comes later.
 * A scope without a stop of its own falls back to the first stop, in content order, from its start ayah onward.
 * An early door is a side path, so it never opens a unit.
 */
export function heroStop<T extends { blockIndex: number; stationKey: string; fromDepth?: Depth }>(
  stops: T[], inScope: (stationKey: string) => boolean, startNumber: number,
): T | undefined {
  const first = (list: T[]) => list.reduce<T | undefined>((best, stop) => !best || stop.blockIndex < best.blockIndex ? stop : best, undefined);
  const own = stops.filter((stop) => stop.fromDepth === undefined);
  return first(own.filter((stop) => inScope(stop.stationKey)))
    ?? first(own.filter((stop) => Number(stop.stationKey.split(":")[1]) >= startNumber));
}
