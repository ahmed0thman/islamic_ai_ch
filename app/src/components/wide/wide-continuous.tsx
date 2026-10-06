"use client";

import type { Block } from "@/lib/types";
import type { SceneUnit } from "@/lib/depth-items";
import { blockAnchor, blockUnit } from "@/lib/wide-index";
import { ContinuousView } from "@/components/reader/continuous-view";
import type { ReadingProps } from "@/components/reader/reading-context";

export function WideContinuous({ blocks, units, ...reading }: ReadingProps & { blocks: Block[]; units: SceneUnit[] }) {
  return <div className="wide-continuous">{blocks.map((block, index) => <div key={index} data-wide-ayah={blockAnchor(block, units, reading.records, reading.surahNo!)} data-wide-unit={blockUnit(block, units)?.number}>
    <ContinuousView blocks={[block]} {...reading} />
  </div>)}</div>;
}
