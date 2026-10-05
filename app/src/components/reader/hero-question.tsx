"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";
import { kindsByCertainty } from "@/lib/rulings";
import { useReading } from "./reading-context";

/** `animate` is false until the reader has restored its depth: that first swap is the page settling, not the reader choosing, so the old title must not cross-fade behind the new one. */
export type HeroQuestionProps = { stop?: SceneUnit; ui: Ui; animate?: boolean; onOpen: (stop: SceneUnit) => void };
export function HeroQuestion({ stop, ui, animate = true, onOpen }: HeroQuestionProps) {
  const { records } = useReading();
  const last = useRef(stop?.title);
  const [previous, setPrevious] = useState<string | undefined>();
  useEffect(() => {
    if (last.current === stop?.title) return;
    const before = last.current;
    last.current = stop?.title;
    if (!animate) return;
    setPrevious(before);
    const timer = window.setTimeout(() => setPrevious(undefined), 200);
    return () => window.clearTimeout(timer);
  }, [stop?.title, animate]);
  if (!stop) return null;
  return <button type="button" className="hero-question" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stop); }}>
    <span key={stop.title} className="hero-title">{stop.title}</span>{previous ? <span className="hero-title hero-previous" aria-hidden="true">{previous}</span> : null}
    <span className="hero-row"><span className="hero-icons" aria-hidden="true">{kindsByCertainty((stop.iconRecordIds ?? stop.recordIds).map((id) => records[id]), ui.icon_order).filter((kind) => stop.icons.includes(kind)).map((kind) => <SourceChip key={kind} kind={kind} ui={ui} />)}</span><span className="hero-go"><Icon icon={ArrowLeft01Icon} size={24} /></span></span>
  </button>;
}
