import type { Segment, Depth } from "../types";
import type { Atom, AtomSource } from "./types";

export function deriveAtoms(surah: AtomSource): Atom[] {
  const ayahs = new Map(surah.ayahs.map((ayah) => [ayah.key, ayah.text]));
  const atoms: Atom[] = [];
  function sentences(segments: Segment[], level: Depth, path: string, role: Atom["role"]) {
    let start = 0, index = 0;
    segments.forEach((segment, end) => {
      if (segment.t !== "mark" || segments[end + 1]?.t === "mark") return;
      const run = segments.slice(start, end + 1);
      const records = [...new Set(run.flatMap((part) => part.t === "mark" ? part.records
        : part.t === "quote" || part.t === "term" ? [part.record] : []))];
      const text = run.map((part) => part.t === "mark" ? "" : part.t === "ayah" ? ayahs.get(part.key)! : part.v).join("");
      atoms.push({ id: `${surah.surah.no}:${level}:${path}:${index++}`, level, role, segments: run, records, text });
      start = end + 1;
    });
  }
  for (const level of [...surah.levels].sort((a, b) => a.depth - b.depth)) {
    level.blocks.forEach((block, i) => {
      if (block.type === "paragraph" && block.role !== "example") sentences(block.segments, level.depth, `blocks.${i}`, block.role);
      if (block.type === "details") {
        sentences(block.title, level.depth, `blocks.${i}.title`, "claim");
        block.blocks.forEach((inner, j) => { if (inner.role !== "example") sentences(inner.segments, level.depth, `blocks.${i}.blocks.${j}`, inner.role); });
      }
    });
  }
  const seen = new Map<string, Depth>();
  return atoms.filter((atom) => {
    const key = JSON.stringify([atom.text, [...atom.records].sort()]);
    const lowest = seen.get(key);
    if (lowest !== undefined && lowest < atom.level) return false;
    seen.set(key, atom.level);
    return true;
  });
}
