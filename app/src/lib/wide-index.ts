import type { Block, Depth, SourceRecord, Surah } from "./types";
import type { SurahMapModel } from "./map";
import type { DepthItemsModel, SceneUnit } from "./depth-items";

export function indexQuestion(title: string): string {
  const end = title.indexOf("\u061f");
  return end < 0 ? title : title.slice(0, end + 1);
}

export function blockRecords(block: Block): string[] {
  const segments = block.type === "paragraph" ? block.segments : block.type === "details" ? [...block.title, ...block.blocks.flatMap((item) => item.segments)] : [];
  return [...new Set(segments.flatMap((segment) => segment.t === "mark" ? segment.records : segment.t === "term" || segment.t === "quote" ? [segment.record] : []))];
}
/** Navigation metadata only. Scene units and blocks remain the existing derivations, by reference. */
export function wideIndex(surah: Surah, map: SurahMapModel, items: DepthItemsModel) {
  const units: SceneUnit[] = map.stops.length ? map.stops : items.units;
  const groups = map.groups.map((group) => ({ ...group, units: units.filter((unit) => unit.stationKey && group.stations.some((station) => station.ayah.key === unit.stationKey)) }));
  const shelf = units.filter((unit) => !unit.stationKey);
  const own = map.groups.flatMap((group) => group.stations.map((station) => station.ayah.key));
  const purpose = Object.values(surah.records).find((record) => record.icons.includes("link") && own.length > 0 && own.every((key) => record.ayah_keys.includes(key)));
  return { groups, shelf, units, purpose };
}
export function unitAtAyah(units: SceneUnit[], key: string | null): SceneUnit | undefined {
  if (!key) return undefined;
  return units.find((unit) => unit.stationKey === key) ?? units.find((unit) => unit.ayahKeys.includes(key));
}
/** The closest cited own ayah lets an untagged depth item keep position without claiming a cross-depth identity. */
export function blockUnit(block: Block, units: SceneUnit[]): SceneUnit | undefined {
  return units.find((unit) => unit.kind === "pin" && unit.openIndex !== undefined && unit.scene[unit.openIndex] === block)
    ?? units.find((unit) => unit.kind !== "pin" && (unit.scene.includes(block) || block.type === "heading" && unit.kind === "section" && unit.title === block.text));
}
export function blockAnchor(block: Block, units: SceneUnit[], records: Surah["records"], surahNo: number): string | undefined {
  const unit = blockUnit(block, units);
  if (unit?.stationKey) return unit.stationKey;
  if (block.type === "ayah") return block.keys.find((key) => key.startsWith(`${surahNo}:`));
  if (block.type === "paragraph" && block.ayahs?.length) return block.ayahs.find((key) => key.startsWith(`${surahNo}:`));
  return blockRecords(block).flatMap((id) => records[id]?.ayah_keys ?? []).filter((key) => key.startsWith(`${surahNo}:`)).sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]))[0];
}
export function passageRecords(surah: Surah, depth: Depth, keys: string[]): SourceRecord[] {
  const level = surah.levels.find((item) => item.depth === depth);
  const ids = [...new Set(level?.blocks.flatMap(blockRecords) ?? [])];
  return ids.flatMap((id) => surah.records[id] ? [surah.records[id]] : []).filter((record) => record.ayah_keys.some((key) => keys.includes(key)));
}
