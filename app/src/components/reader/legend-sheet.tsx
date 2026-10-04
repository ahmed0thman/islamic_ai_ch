"use client";

import type { BadgeKey, Ui } from "@/lib/types";
import { SourceChip } from "@/components/ui/source-chip";
import { SourceBadge } from "@/components/ui/source-badge";
import { BottomSheet } from "./bottom-sheet";

export type LegendSheetProps = { ui: Ui; onClose: () => void };
export function LegendSheet({ ui, onClose }: LegendSheetProps) {
  return <BottomSheet title={ui.legend.title} ui={ui} onClose={onClose}>
    <section className="sheet-legend-section"><h3>{ui.legend.icons_title}</h3><dl>{ui.icon_order.map((kind) => <div className="sheet-legend-entry" key={kind}><dt><SourceChip kind={kind} ui={ui} size="legend" /><span>{ui.icons[kind].label}</span></dt><dd>{ui.icons[kind].meaning}</dd></div>)}</dl></section>
    <section className="sheet-legend-section"><h3>{ui.legend.badges_title}</h3><dl>{(Object.keys(ui.badges) as BadgeKey[]).map((kind) => <div className="sheet-legend-entry" key={kind}><dt><SourceBadge kind={kind} ui={ui} /></dt><dd>{ui.badges[kind].meaning}</dd></div>)}</dl><p className="sheet-label">{ui.link_strength.note}</p></section>
  </BottomSheet>;
}
