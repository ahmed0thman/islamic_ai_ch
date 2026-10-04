"use client";

import type { SourceRecord, Ui } from "@/lib/types";
import { SourceChip } from "@/components/ui/source-chip";
import { SourceBadge } from "@/components/ui/source-badge";

export type SourceMarkerProps = { records: SourceRecord[]; ui: Ui; onOpen: () => void };
export function SourceMarker({ records, ui, onOpen }: SourceMarkerProps) {
  const kinds = ui.icon_order.filter((kind) => records.some((record) => record.icons.includes(kind)));
  const badges = [...new Set(records.map((record) => record.badge))].filter(
    (kind): kind is "la_yathbut" | "khilaf_mutabar" => kind === "la_yathbut" || kind === "khilaf_mutabar",
  );
  const label = [ui.panel.title, ...kinds.map((kind) => ui.icons[kind].label), ...badges.map((kind) => ui.badges[kind].label), ...records.map((record) => record.claim)].join(" — ");
  return <button className="source-marker" type="button" aria-label={label} aria-haspopup="dialog" onClick={(event) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onOpen();
  }}>
    {kinds.map((kind) => <SourceChip key={kind} kind={kind} ui={ui} size="small" />)}
    {badges.map((kind) => <SourceBadge key={kind} kind={kind} ui={ui} />)}
  </button>;
}
