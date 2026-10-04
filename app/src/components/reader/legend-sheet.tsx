"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { CSSProperties } from "react";
import type { BadgeKey, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";
import { SourceBadge } from "@/components/ui/source-badge";
import { BottomSheet } from "./bottom-sheet";
import { useSheets } from "./sheet-provider";

export type LegendSheetProps = { ui: Ui };
export function LegendSheet({ ui }: LegendSheetProps) {
  const { legendOpen, openLegend, closeSheet } = useSheets();
  return <>
    <aside className="huda-legend-bar" aria-label={ui.legend.title}>
      <Button variant="pill" size="lg" aria-haspopup="dialog" aria-expanded={legendOpen} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); openLegend(); }}>
        <Icon icon={InformationCircleIcon} />{ui.legend.show}
        <span className="legend-dots" aria-hidden="true">{ui.icon_order.map((kind) => <span key={kind} style={{ "--tone": ui.icons[kind].color } as CSSProperties} />)}</span>
      </Button>
    </aside>
    {legendOpen ? <BottomSheet title={ui.legend.title} ui={ui} onClose={closeSheet}>
      <section className="sheet-legend-section"><h3>{ui.legend.icons_title}</h3><dl>
        {ui.icon_order.map((kind) => <div className="sheet-legend-entry" key={kind}><dt><SourceChip kind={kind} ui={ui} size="legend" /><span>{ui.icons[kind].label}</span></dt><dd>{ui.icons[kind].meaning}</dd></div>)}
      </dl></section>
      <section className="sheet-legend-section"><h3>{ui.legend.badges_title}</h3><dl>
        {(Object.keys(ui.badges) as BadgeKey[]).map((kind) => <div className="sheet-legend-entry" key={kind}><dt><SourceBadge kind={kind} ui={ui} /></dt><dd>{ui.badges[kind].meaning}</dd></div>)}
      </dl><p className="sheet-label">{ui.link_strength.note}</p></section>
    </BottomSheet> : null}
  </>;
}
