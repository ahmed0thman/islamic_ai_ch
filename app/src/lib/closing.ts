import type { Passage } from "./types";

/** A passage of the surah in the closing screen, with the stop the reader reaches by pressing it (none when this level has no stop in it). */
export interface ClosingPart<U> { passage: Passage; unit?: U }
type Placed = { blockIndex: number; passage?: string };

/** The surah's passages in their order; each points at its first stop in reading order (the lowest block) in the level shown. A surah without passages has no parts. */
export function closingParts<U extends Placed>(passages: readonly Passage[] | undefined, units: readonly U[]): ClosingPart<U>[] {
  return (passages ?? []).map((passage) => ({
    passage,
    unit: units.filter((unit) => unit.passage === passage.id).reduce<U | undefined>((first, unit) => !first || unit.blockIndex < first.blockIndex ? unit : first, undefined),
  }));
}

/** The stop the closing screen's "previous" returns to: the last one in reading order (the highest block). */
export function lastStop<U extends Placed>(stops: readonly U[]): U | undefined {
  return stops.reduce<U | undefined>((last, stop) => !last || stop.blockIndex > last.blockIndex ? stop : last, undefined);
}
