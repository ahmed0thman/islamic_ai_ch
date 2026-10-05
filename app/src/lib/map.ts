import type { Ayah, Block, Depth, IconKey, ParagraphBlock, Passage, Surah } from "./types";

export interface MapStop {
  /** One-based position along the visible map, also used in the URL. */
  number: number;
  blockIndex: number;
  title: string;
  ayahKeys: string[];
  stationKey: string;
  passage?: string;
  scene: ParagraphBlock[];
  recordIds: string[];
  icons: IconKey[];
}
export interface MapStation { ayah: Ayah; stops: MapStop[] }
export interface MapGroup { passage?: Passage; stations: MapStation[] }
export interface SurahMapModel {
  /** The closing synthesis of the level, when it has one. It is never a stop, a scene paragraph or part of the continuous blocks: the closing screen shows it. */
  summary?: ParagraphBlock;
  groups: MapGroup[];
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

/** Derive the map without changing any content, paragraph, segment or record. */
export function deriveSurahMap(surah: Surah, depth: Depth): SurahMapModel {
  const blocks = surah.levels.find((level) => level.depth === depth)?.blocks ?? [];
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
        stops: stops.filter((stop) => stop.stationKey === ayah.key && stop.passage === passage?.id),
      })),
    };
  });
  const ordered = groups.flatMap((group) => group.stations.flatMap((station) => station.stops));
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
 */
export function heroStop<T extends { blockIndex: number; stationKey: string }>(
  stops: T[], inScope: (stationKey: string) => boolean, startNumber: number,
): T | undefined {
  const first = (list: T[]) => list.reduce<T | undefined>((best, stop) => !best || stop.blockIndex < best.blockIndex ? stop : best, undefined);
  return first(stops.filter((stop) => inScope(stop.stationKey)))
    ?? first(stops.filter((stop) => Number(stop.stationKey.split(":")[1]) >= startNumber));
}
