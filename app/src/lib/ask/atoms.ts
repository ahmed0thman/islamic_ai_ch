// @ts-expect-error -- Node tests require explicit source extensions.
import { deriveSurahMap } from "../map.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { deriveDepthItems } from "../depth-items.ts";
import type { Segment, Depth } from "../types";
import type { Atom, AtomSource, ReaderContext } from "./types";

// Whitespace plus U+002E, U+060C, U+061B, U+003A, U+061F, U+0021, U+2026: the stop that closed the previous sentence.
const LEADING_PUNCTUATION = /^[\s\u002E\u060C\u061B\u003A\u061F\u0021\u2026]+/;
/** Strip stray punctuation from the start of the first text segment(s) of an atom; nothing else changes. */
function stripLeadingPunctuation(run: Segment[]): Segment[] {
  let at = 0, first: Segment | undefined;
  while ((first = run[at])?.t === "text") {
    const v = first.v.replace(LEADING_PUNCTUATION, "");
    if (v === first.v) return run.slice(at);
    if (v) return [{ ...first, v }, ...run.slice(at + 1)];
    at++;
  }
  return run.slice(at);
}

export function deriveAtoms(surah: AtomSource): Atom[] {
  const ayahs = new Map(surah.ayahs.map((ayah) => [ayah.key, ayah.text]));
  const atoms: Atom[] = [];
  function sentences(segments: Segment[], level: Depth, path: string, role: Atom["role"], stops: number[]) {
    let start = 0, index = 0;
    segments.forEach((segment, end) => {
      if (segment.t !== "mark" || segments[end + 1]?.t === "mark") return;
      const run = stripLeadingPunctuation(segments.slice(start, end + 1));
      const records = [...new Set(run.flatMap((part) => part.t === "mark" ? part.records
        : part.t === "quote" || part.t === "term" ? [part.record] : []))];
      const text = run.map((part) => part.t === "mark" ? "" : part.t === "ayah" ? ayahs.get(part.key)! : part.v).join("");
      atoms.push({ id: `${surah.surah.no}:${level}:${path}:${index++}`, level, role, segments: run, records, text, locations: [{ depth: level, stops }] });
      start = end + 1;
    });
  }
  for (const level of [...surah.levels].sort((a, b) => a.depth - b.depth)) {
    const units = readerUnits(surah, level.depth);
    level.blocks.forEach((block, i) => {
      const stops = block.type === "paragraph" && block.kind === "summary" ? []
        : units.filter((unit) => unit.scene.some((part) => part === block)).map((unit) => unit.number);
      if (block.type === "paragraph" && block.role !== "example") sentences(block.segments, level.depth, `blocks.${i}`, block.role, stops);
      if (block.type === "details") {
        sentences(block.title, level.depth, `blocks.${i}.title`, "claim", stops);
        block.blocks.forEach((inner, j) => { if (inner.role !== "example") sentences(inner.segments, level.depth, `blocks.${i}.blocks.${j}`, inner.role, stops); });
      }
    });
  }
  const seen = new Map<string, Atom>();
  return atoms.filter((atom) => {
    const key = JSON.stringify([atom.text, [...atom.records].sort()]);
    const lowest = seen.get(key);
    if (lowest && lowest.level < atom.level) {
      lowest.locations!.push(...atom.locations!);
      return false;
    }
    seen.set(key, atom);
    return true;
  });
}

export function readerUnits(surah: AtomSource, depth: Depth) {
  const map = deriveSurahMap(surah, depth);
  return map.stops.length ? map.stops : deriveDepthItems(surah, depth).units;
}

/** Invalid optional context is ignored; a valid depth still helps without a stop. */
export function resolveReaderContext(surah: AtomSource, depth: unknown, stop: unknown): ReaderContext | undefined {
  if (typeof depth !== "number" || ![0, 1, 2, 3].includes(depth)) return undefined;
  const context: ReaderContext = { depth: depth as Depth };
  if (typeof stop !== "number" || !Number.isInteger(stop) || stop < 1) return context;
  const unit = readerUnits(surah, context.depth).find((unit) => unit.number === stop);
  if (!unit) return context;
  return { ...context, stop, stop_title: unit.title,
    stop_ayahs: unit.ayahKeys.map((key) => ({ key, text: surah.ayahs.find((ayah) => ayah.key === key)!.text })) };
}
