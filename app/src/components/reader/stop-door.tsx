"use client";

import type { Ref } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Depth, Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SourceBadge } from "@/components/ui/source-badge";
import { SourceChip } from "@/components/ui/source-chip";
import { badgesByCertainty, kindsByCertainty } from "@/lib/rulings";
import { numeral } from "@/lib/numerals";
import { askedAt } from "@/lib/asked";
import { useReading } from "./reading-context";
import { useAsk } from "./ask-state";
import { MisconceptionBadge, misconceptionLabel } from "./misconception-frame";

/** `fromDepth` is set on an early door only (a misconception stop of a deeper level shown on this one, see `MapStop`). */
export type StopDoorProps = { stop: SceneUnit & { fromDepth?: Depth }; seen: boolean; ui: Ui; onOpen: (stop: SceneUnit) => void; buttonRef?: Ref<HTMLButtonElement> };
export function StopDoor({ stop, seen, ui, onOpen, buttonRef }: StopDoorProps) {
  const { records } = useReading();
  const kinds = kindsByCertainty((stop.iconRecordIds ?? stop.recordIds).map((id) => records[id]), ui.icon_order).filter((kind) => stop.icons.includes(kind));
  const badges = badgesByCertainty(stop.badges ?? []);
  // The reader's own questions asked at this door: a gold dot with their number.
  const ask = useAsk();
  const asked = ask ? askedAt(ask.entries, ask.depth, stop.number).length : 0;
  return <button type="button" className={`stop-door${stop.kind === "pin" ? " is-depth" : ""}`} data-stop={stop.number} data-seen={seen || undefined} ref={buttonRef} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stop); }} aria-label={[stop.title, ...(stop.kind === "misconception" ? misconceptionLabel(ui, stop.fromDepth) : []), ...(stop.kind === "pin" ? [ui.reader.depth_item] : []), ...kinds.map((kind) => ui.icons[kind].label), ...badges.map((kind) => ui.badges[kind].label), ...(asked ? [`${ui.ask.your_questions} ${numeral(asked)}`] : [])].join(" — ")}>
    <span className="stop-door-title">{stop.title}{stop.kind === "misconception" ? <> <MisconceptionBadge ui={ui} from={stop.fromDepth} /></> : null}</span><span className="stop-door-icons" aria-hidden="true">{kinds.map((kind) => <SourceChip key={kind} kind={kind} ui={ui} size="small" />)}{badges.map((kind) => <SourceBadge key={kind} kind={kind} ui={ui} />)}{asked ? <span className="stop-door-asked"><i />{numeral(asked)}</span> : null}</span><Icon className="stop-door-chevron" icon={ArrowLeft01Icon} />
  </button>;
}
