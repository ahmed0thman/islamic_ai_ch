"use client";

import type { CSSProperties } from "react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSheets } from "./sheet-provider";

export type LegendTriggerProps = { ui: Ui; fixed?: boolean };
export function LegendTrigger({ ui, fixed = false }: LegendTriggerProps) {
  const { legendOpen, openLegend } = useSheets();
  const trigger = <Button variant="pill" size="lg" aria-haspopup="dialog" aria-expanded={legendOpen} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); openLegend(); }}><Icon icon={InformationCircleIcon} />{ui.legend.show}<span className="legend-dots" aria-hidden="true">{ui.icon_order.map((kind) => <span key={kind} style={{ "--tone": ui.icons[kind].color } as CSSProperties} />)}</span></Button>;
  return fixed ? <aside className="huda-legend-bar" aria-label={ui.legend.title}>{trigger}</aside> : trigger;
}
