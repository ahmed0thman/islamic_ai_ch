import type { Block, Depth, Segment, SourceRecord, Surah } from "./types";

export function relationRecords(surah: Surah, depth: Depth): SourceRecord[] {
  const own = new Set(surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).map((ayah) => ayah.key));
  const cited = new Set<string>();
  const read = (segments: Segment[]) => { for (const segment of segments) if (segment.t === "mark") for (const id of segment.records) cited.add(id); };
  for (const block of surah.levels.find((level) => level.depth === depth)?.blocks ?? []) {
    if (block.type === "paragraph") read(block.segments);
    else if (block.type === "details") { read(block.title); block.blocks.forEach((inner) => read(inner.segments)); }
  }
  return [...cited].map((id) => surah.records[id]).filter((record) => record.icons.includes("link")
    && record.depth_min <= depth && new Set(record.ayah_keys.filter((key) => own.has(key))).size === 2);
}
export function blockRelationIds(block: Block): string[] {
  const segments = block.type === "paragraph" ? block.segments : block.type === "details" ? [...block.title, ...block.blocks.flatMap((inner) => inner.segments)] : [];
  return [...new Set(segments.flatMap((segment) => segment.t === "mark" ? segment.records : []))];
}
