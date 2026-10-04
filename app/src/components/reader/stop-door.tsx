"use client";

import type { Ref } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { MapStop } from "@/lib/map";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";

export type StopDoorProps = { stop: MapStop; seen: boolean; ui: Ui; onOpen: (stop: MapStop) => void; buttonRef?: Ref<HTMLButtonElement> };
export function StopDoor({ stop, seen, ui, onOpen, buttonRef }: StopDoorProps) {
  return <button type="button" className="stop-door" data-stop={stop.number} data-seen={seen || undefined} ref={buttonRef} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stop); }} aria-label={[stop.title, ...ui.icon_order.filter((kind) => stop.icons.includes(kind)).map((kind) => ui.icons[kind].label)].join(" — ")}>
    <span className="stop-door-title">{stop.title}</span><span className="stop-door-icons" aria-hidden="true">{ui.icon_order.filter((kind) => stop.icons.includes(kind)).map((kind) => <SourceChip key={kind} kind={kind} ui={ui} size="small" />)}</span><Icon className="stop-door-chevron" icon={ArrowLeft01Icon} />
  </button>;
}
