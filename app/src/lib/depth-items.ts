import type { BadgeKey, Block, Depth, IconKey, Segment, Surah } from "./types";

/** What a scene shows. A `MapStop` already satisfies it; pins and shelf sections come from `deriveDepthItems`. */
export interface SceneUnit {
  number: number;
  blockIndex: number;
  title: string;
  ayahKeys: string[];
  stationKey: string;
  passage?: string;
  scene: Block[];
  recordIds: string[];
  icons: IconKey[];
  /** The records behind `icons`, when they are fewer than `recordIds` (a pin shows its own item's kinds, not its section's). */
  iconRecordIds?: string[];
  /** Absent on a map stop. */
  kind?: "pin" | "section";
  /** A pin opens its section with this block (a `details` item) already open. */
  openIndex?: number;
  /** Scene heading when it differs from the door title: pins open the section they belong to. */
  sceneTitle?: string;
  question?: boolean;
  /** Qualifications carried by the title's records, shown on the door next to the chips. */
  badges?: BadgeKey[];
}
export interface DepthItemsModel {
  /** Doors hanging under the earliest own ayah their title's records point to, in thread order. */
  pins: SceneUnit[];
  /** Every section as a door after the last ayah, in content order. */
  shelf: SceneUnit[];
  /** `pins` then `shelf`; `number` is the position here, starting at 1. */
  units: SceneUnit[];
}

const iconOrder: IconKey[] = ["ayah", "hadith", "athar", "scholar", "link", "hidaya"];
const empty: DepthItemsModel = { pins: [], shelf: [], units: [] };

function segmentsOf(block: Block): Segment[] {
  if (block.type === "paragraph") return block.segments;
  if (block.type === "details") return [...block.title, ...block.blocks.flatMap((inner) => inner.segments)];
  return [];
}
function recordIdsOf(segments: Segment[]): string[] {
  const ids = new Set<string>();
  for (const segment of segments) {
    if (segment.t === "mark") segment.records.forEach((id) => ids.add(id));
    else if (segment.t === "quote" || segment.t === "term") ids.add(segment.record);
  }
  return [...ids];
}
const flatText = (title: Segment[]) => title.map((segment) => segment.t === "text" || segment.t === "term" ? segment.v : "").join("").replace(/\s+/g, " ").trim();

/**
 * Levels without titled stops (depth 3 today) have no map doors: their content is sections of a heading,
 * paragraphs and `details` items. Each `details` item becomes a pin under the earliest own ayah that the
 * records in its title point to (record data only; a title without such a record has no pin and stays
 * reachable through its section). Each section becomes a shelf door. Content is never changed or filtered.
 * A level that has titled stops keeps its map and gets an empty model.
 */
export function deriveDepthItems(surah: Surah, depth: Depth): DepthItemsModel {
  const blocks = surah.levels.find((level) => level.depth === depth)?.blocks ?? [];
  if (blocks.some((block) => block.type === "paragraph" && block.title)) return empty;
  type Section = { heading?: Extract<Block, { type: "heading" }>; blocks: { block: Block; index: number }[] };
  const sections: Section[] = [];
  let section: Section | undefined;
  blocks.forEach((block, index) => {
    // The closing summary is not a section: the closing screen shows it.
    if (block.type === "ayah" || (block.type === "paragraph" && block.kind === "summary")) return;
    if (block.type === "heading") { section = { heading: block, blocks: [] }; sections.push(section); return; }
    if (!section) { section = { blocks: [] }; sections.push(section); }
    section.blocks.push({ block, index });
  });
  const filled = sections.filter((item) => item.blocks.length);
  const own = new Set(surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).map((ayah) => ayah.key));
  const numberOf = (key: string) => Number(key.split(":")[1]);
  const iconsOf = (ids: string[]) => iconOrder.filter((icon) => ids.some((id) => surah.records[id].icons.includes(icon)));
  const draftPins: Omit<SceneUnit, "number">[] = [];
  const draftShelf: Omit<SceneUnit, "number">[] = [];
  filled.forEach((item, sectionIndex) => {
    const scene = item.blocks.map((entry) => entry.block);
    const heading = item.heading?.text ?? surah.surah.name;
    const question = item.heading?.kind === "question";
    const recordIds = recordIdsOf(scene.flatMap(segmentsOf));
    draftShelf.push({ blockIndex: blocks.length + sectionIndex, title: heading, ayahKeys: [], stationKey: "", scene, recordIds, icons: iconsOf(recordIds), kind: "section", sceneTitle: heading, question });
    item.blocks.forEach(({ block, index }, openIndex) => {
      if (block.type !== "details") return;
      const marks = block.title.flatMap((segment) => segment.t === "mark" ? segment.records : []);
      const anchors = marks.flatMap((id) => surah.records[id].ayah_keys).filter((key) => own.has(key)).sort((a, b) => numberOf(a) - numberOf(b));
      if (!anchors.length) return;
      const pinIds = recordIdsOf(segmentsOf(block));
      const badges = [...new Set(marks.map((id) => surah.records[id].badge))].filter((kind): kind is BadgeKey => kind === "la_yathbut" || kind === "khilaf_mutabar");
      const passage = surah.passages?.find((entry) => numberOf(anchors[0]) >= numberOf(entry.from) && numberOf(anchors[0]) <= numberOf(entry.to));
      // The door shows what its own item carries; the scene shows the whole section, so its sources cover the section.
      draftPins.push({ blockIndex: index, title: flatText(block.title), ayahKeys: [anchors[0]], stationKey: anchors[0], passage: passage?.id, scene, recordIds, icons: iconsOf(pinIds), iconRecordIds: pinIds, kind: "pin", openIndex, sceneTitle: heading, question, badges });
    });
  });
  draftPins.sort((a, b) => numberOf(a.stationKey) - numberOf(b.stationKey) || a.blockIndex - b.blockIndex);
  const units = [...draftPins, ...draftShelf].map((unit, index): SceneUnit => ({ ...unit, number: index + 1 }));
  return { pins: units.slice(0, draftPins.length), shelf: units.slice(draftPins.length), units };
}

/** The units a reader steps through from this one: pins walk the pins, sections walk the shelf. */
export function depthPlaylist(model: DepthItemsModel, unit: SceneUnit): SceneUnit[] {
  return unit.kind === "section" ? model.shelf : model.pins;
}
export function sceneNeighbours<T extends { number: number }>(list: T[], number: number): { previous?: T; next?: T } {
  const index = list.findIndex((unit) => unit.number === number);
  return { previous: index > 0 ? list[index - 1] : undefined, next: index >= 0 ? list[index + 1] : undefined };
}
/** First door to invite with: the whole surah starts at the first shelf question; a narrower unit at the first pin at or after it. */
export function depthHero(model: DepthItemsModel, startNumber: number, wholeSurah: boolean): SceneUnit | undefined {
  if (wholeSurah) return model.shelf[0] ?? model.pins[0];
  return model.pins.find((pin) => Number(pin.stationKey.split(":")[1]) >= startNumber) ?? model.shelf[0];
}
