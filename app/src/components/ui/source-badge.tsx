import type { CSSProperties } from "react";
import type { BadgeKey, Ui } from "@/lib/types";
import { Badge } from "./badge";

export type SourceBadgeProps = { kind: BadgeKey; ui: Ui };
export function SourceBadge({ kind, ui }: SourceBadgeProps) {
  const entry = ui.badges[kind];
  return <Badge variant="tone" style={{ "--tone": entry.color } as CSSProperties}>{entry.label}</Badge>;
}
