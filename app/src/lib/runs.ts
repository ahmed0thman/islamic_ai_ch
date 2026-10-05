import type { ParagraphBlock, Segment } from "./types";

/** A mark is the only attribution boundary. Preserve every segment, including the tail. */
export function toRuns(segments: Segment[]): Segment[][] {
  const runs: Segment[][] = [];
  let run: Segment[] = [];
  for (const segment of segments) {
    run.push(segment);
    if (segment.t === "mark") { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs;
}
export function shouldStack(block: ParagraphBlock, runs: Segment[][]): boolean {
  return block.role === "claim" && runs.filter((run) => run.at(-1)?.t === "mark").length >= 3
    && block.segments.reduce((length, segment) => length + ("v" in segment ? segment.v.length : 0), 0) > 400;
}

/** Separators a sentence leaves behind once the ayah that began it is lifted away. Opening quotes and brackets stay: they start something. */
const hangingPunctuation = /^[\s\p{Pd}\p{Po}\p{Pe}\p{Pf}]+/u;
/**
 * A paragraph that opens with ayahs already shown on the stage above it does not show them a second time:
 * each leading ayah segment is lifted off, and the separator that followed it (a comma, a full stop, a space) goes with
 * it so the sentence starts clean. Only the opening run qualifies; an ayah in the middle, one the stage does not show, or
 * one that carries its own source mark right after it, stays. Content is never mutated: this returns a new block
 * (the same block when nothing is lifted).
 */
export function dropStageAyah(block: ParagraphBlock, shown: readonly string[]): ParagraphBlock {
  let segments = block.segments;
  for (;;) {
    const [first, second, ...rest] = segments;
    if (first?.t !== "ayah" || !shown.includes(first.key) || second?.t === "mark") break;
    if (second?.t !== "text") { segments = segments.slice(1); continue; }
    const text = second.v.replace(hangingPunctuation, "");
    segments = text ? [{ ...second, v: text }, ...rest] : rest;
  }
  return segments === block.segments ? block : { ...block, segments };
}
