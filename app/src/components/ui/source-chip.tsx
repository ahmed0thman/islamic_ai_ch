import type { CSSProperties } from "react";
import type { IconKey, Ui } from "@/lib/types";

export type SourceChipProps = { kind: IconKey; ui: Ui; size?: "small" | "default" | "legend" };
export function SourceChip({ kind, ui, size = "default" }: SourceChipProps) {
  const entry = ui.icons[kind];
  return <span className={`source-chip source-tone source-chip-${size}`} style={{ "--tone": entry.color } as CSSProperties} aria-hidden="true">{entry.symbol}</span>;
}
