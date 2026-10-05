import type { CSSProperties } from "react";
import type { BadgeKey, StateKey, Ui } from "@/lib/types";
import { Badge } from "./badge";

export type SourceBadgeProps = { ui: Ui } & ({ kind: BadgeKey; state?: never } | { state: StateKey; kind?: never });
export function SourceBadge({ kind, state, ui }: SourceBadgeProps) {
  const entry = kind ? ui.badges[kind] : ui.states[state!];
  return <Badge variant="tone" className="source-badge" data-state={state} style={{ "--tone": entry.color } as CSSProperties}>{entry.label}</Badge>;
}
