"use client";

import type { Ref } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SourceBadge } from "@/components/ui/source-badge";
import { SourceChip } from "@/components/ui/source-chip";

export type StopDoorProps = { stop: SceneUnit; seen: boolean; ui: Ui; onOpen: (stop: SceneUnit) => void; buttonRef?: Ref<HTMLButtonElement> };
export function StopDoor({ stop, seen, ui, onOpen, buttonRef }: StopDoorProps) {
  const kinds = ui.icon_order.filter((kind) => stop.icons.includes(kind));
  const badges = stop.badges ?? [];
  return <button type="button" className={`stop-door${stop.kind === "pin" ? " is-depth" : ""}`} data-stop={stop.number} data-seen={seen || undefined} ref={buttonRef} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stop); }} aria-label={[stop.title, ...(stop.kind === "pin" ? [ui.reader.depth_item] : []), ...kinds.map((kind) => ui.icons[kind].label), ...badges.map((kind) => ui.badges[kind].label)].join(" — ")}>
    <span className="stop-door-title">{stop.title}</span><span className="stop-door-icons" aria-hidden="true">{kinds.map((kind) => <SourceChip key={kind} kind={kind} ui={ui} size="small" />)}{badges.map((kind) => <SourceBadge key={kind} kind={kind} ui={ui} />)}</span><Icon className="stop-door-chevron" icon={ArrowLeft01Icon} />
  </button>;
}
