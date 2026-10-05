"use client";

import type { SourceRecord, Ui } from "@/lib/types";
import { SourceChip } from "@/components/ui/source-chip";
import { SourceBadge } from "@/components/ui/source-badge";
import { numeral } from "@/lib/numerals";
import { badgesByCertainty, kindsByCertainty } from "@/lib/rulings";

export type SourceMarkerProps = { records: SourceRecord[]; ui: Ui; onOpen: () => void };
export function SourceMarker({ records, ui, onOpen }: SourceMarkerProps) {
  // The firmest record speaks first: its kinds lead the chips, and the qualifications follow the same order.
  const kinds = kindsByCertainty(records, ui.icon_order);
  const badges = badgesByCertainty(records.map((record) => record.badge));
  const states = Array.from(new Set(records.map((record) => record.state).filter((state): state is NonNullable<SourceRecord["state"]> => state != null)));
  // Short on purpose: the question, the kinds of source, the count. The records' own text lives in the sheet.
  const label = [ui.panel.title, [...kinds.map((kind) => ui.icons[kind].label), ...badges.map((kind) => ui.badges[kind].label), ...states.map((state) => ui.states[state].label)].join("، "), `${ui.panel.sources_count}: ${numeral(records.length)}`].filter(Boolean).join(" — ");
  return <button className="source-marker" type="button" aria-label={label} aria-haspopup="dialog" onClick={(event) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onOpen();
  }}>
    {kinds.map((kind) => <SourceChip key={kind} kind={kind} ui={ui} size="small" />)}
    {badges.map((kind) => <SourceBadge key={kind} kind={kind} ui={ui} />)}
    {states.map((state) => <SourceBadge key={state} state={state} ui={ui} />)}
  </button>;
}
