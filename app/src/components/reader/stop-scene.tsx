"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Passage, SurahSummary } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ReadingProps } from "./reading-context";
import { AyahStage } from "./ayah-stage";
import { ContinuousView } from "./continuous-view";
import { StopSources } from "./stop-sources";
import { NextCard } from "./next-card";
import { SourceMarker } from "./source-marker";

export type StopSceneProps = ReadingProps & { stop: SceneUnit; stops: SceneUnit[]; previous?: SceneUnit; next?: SceneUnit; passage?: Passage; nextPassage?: Passage; nextSurah?: SurahSummary; onNavigate: (stop: SceneUnit) => void; onBack: () => void };
export function StopScene({ stop, stops, previous, next, passage, nextPassage, nextSurah, onNavigate, onBack, ...reading }: StopSceneProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const last = useRef(stop.number);
  const direction = stop.number === last.current ? "scene-body-enter" : stop.number > last.current ? "scene-body-next" : "scene-body-previous";
  const [origin] = useState(() => ({ opener: typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null, y: typeof window !== "undefined" ? window.scrollY : 0 }));
  useEffect(() => {
    heading.current?.focus({ preventScroll: true }); if (scroll.current) scroll.current.scrollTop = 0; last.current = stop.number;
    if (stop.openIndex === undefined) return;
    // A depth pin opens its section with one item open: bring that item into view once the scene has settled.
    const timer = window.setTimeout(() => {
      const container = scroll.current, item = container?.querySelector<HTMLElement>("details[open]");
      if (!container || !item) return;
      const top = item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 72;
      container.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [stop.number, stop.openIndex]);
  const sources = stop.recordIds.map((id) => reading.records[id]);
  return <Dialog open onOpenChange={(open) => { if (!open) onBack(); }}>
    <DialogContent className="huda-stop-scene" overlayClassName="scene-scrim" showCloseButton={false} aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); window.scrollTo({ top: origin.y, behavior: "instant" }); origin.opener?.focus({ preventScroll: true }); }}>
      <header className="scene-topbar"><Button variant="quiet" onClick={onBack}><Icon icon={ArrowRight01Icon} />{reading.ui.reader.back}</Button><div className="scene-pips" aria-hidden="true">{stops.map((item) => <span key={item.number} data-state={item.number === stop.number ? "here" : item.number < stop.number ? "done" : "todo"} />)}</div><div className="scene-nav"><Button variant="round" size="icon" disabled={!previous} aria-label={reading.ui.reader.previous_stop} onClick={() => { if (previous) onNavigate(previous); }}><Icon icon={ArrowRight01Icon} /></Button><Button variant="round" size="icon" disabled={!next} aria-label={reading.ui.reader.next_stop} onClick={() => { if (next) onNavigate(next); }}><Icon icon={ArrowLeft01Icon} /></Button></div></header>
      <div className="huda-scene-scroll" ref={scroll}><div key={stop.blockIndex} className={`huda-scene-body ${direction}`}>
        <AyahStage ayahs={stop.ayahKeys.map((key) => reading.ayahs.get(key)!)} ui={reading.ui} />
        <div className="scene-heading">{passage ? <p className="scene-kicker" data-run={`scene-passage-${passage.id}`}>{passage.title}<SourceMarker records={passage.records.map((id) => reading.records[id])} ui={reading.ui} onOpen={() => reading.onOpen(passage.records.map((id) => reading.records[id]))} /></p> : null}<DialogTitle asChild><h2 ref={heading} tabIndex={-1} className={`huda-scene-title${stop.question ? " is-question" : ""}`}>{stop.sceneTitle ?? stop.title}</h2></DialogTitle></div>
        <div className="scene-reading"><ContinuousView blocks={stop.scene} showTitles={false} openIndex={stop.openIndex} {...reading} /><StopSources records={sources} ui={reading.ui} onOpen={reading.onOpen} /><NextCard next={next} previous={previous} nextPassage={nextPassage} nextSurah={nextSurah} ui={reading.ui} records={reading.records} onOpen={reading.onOpen} onNext={() => { if (next) onNavigate(next); }} onPrevious={() => { if (previous) onNavigate(previous); }} onBack={onBack} /></div>
      </div></div>
    </DialogContent>
  </Dialog>;
}
