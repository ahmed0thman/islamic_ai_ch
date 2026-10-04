"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";

export type HeroQuestionProps = { stop?: SceneUnit; ui: Ui; onOpen: (stop: SceneUnit) => void };
export function HeroQuestion({ stop, ui, onOpen }: HeroQuestionProps) {
  const last = useRef(stop?.title);
  const [previous, setPrevious] = useState<string | undefined>();
  useEffect(() => {
    if (last.current === stop?.title) return;
    setPrevious(last.current); last.current = stop?.title;
    const timer = window.setTimeout(() => setPrevious(undefined), 200);
    return () => window.clearTimeout(timer);
  }, [stop?.title]);
  if (!stop) return null;
  return <button type="button" className="hero-question" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stop); }}>
    <span key={stop.title} className="hero-title">{stop.title}</span>{previous ? <span className="hero-title hero-previous" aria-hidden="true">{previous}</span> : null}
    <span className="hero-row"><span className="hero-icons" aria-hidden="true">{ui.icon_order.filter((kind) => stop.icons.includes(kind)).map((kind) => <SourceChip key={kind} kind={kind} ui={ui} />)}</span><span className="hero-go"><Icon icon={ArrowLeft01Icon} size={24} /></span></span>
  </button>;
}
