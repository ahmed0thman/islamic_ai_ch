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
