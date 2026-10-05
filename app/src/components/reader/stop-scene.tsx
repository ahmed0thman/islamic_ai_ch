"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Passage, SurahSummary } from "@/lib/types";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ReadingProps } from "./reading-context";
import { AyahStage, stageShownKeys } from "./ayah-stage";
import { ContinuousView } from "./continuous-view";
import { StopSources } from "./stop-sources";
import { NextCard } from "./next-card";
import { TermsSummary } from "./terms-summary";
import type { TermsSummary as Summary } from "@/lib/terms-summary";
import { SourceMarker } from "./source-marker";
import type { Followup } from "@/lib/followups";
import { AskedSection } from "./asked-section";
import { AskDock } from "./ask-dock";
import { FollowupsSection } from "./followups-section";

export type StopSceneProps = ReadingProps & { stop: SceneUnit; stops: SceneUnit[]; previous?: SceneUnit; next?: SceneUnit; passage?: Passage; nextPassage?: Passage; nextSurah?: SurahSummary; termsSummary?: Summary | null; /** Deeper questions that share an ayah with this stop, from `deriveFollowups`; none at the deepest level. */ followups?: Followup[]; /** Ids among them to show first and open (the server fills it later from the reader's own questions). */ promoted?: string[]; /** The level closes with a summary screen: the last stop leads to it instead of ending on the next surah. */ onClosing?: () => void; onNavigate: (stop: SceneUnit) => void; onBack: () => void };
/** The body of a stop scene; `SceneShell` holds the dialog around it. */
export function StopScene({ stop, stops, previous, next, passage, nextPassage, nextSurah, termsSummary, followups = [], promoted, onClosing, onNavigate, onBack, ...reading }: StopSceneProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const position = stops.indexOf(stop);
  const last = useRef(position);
  const direction = position === last.current ? "scene-body-enter" : position > last.current ? "scene-body-next" : "scene-body-previous";
  useEffect(() => {
    heading.current?.focus({ preventScroll: true }); if (scroll.current) scroll.current.scrollTop = 0; last.current = position;
    if (stop.openIndex === undefined) return;
    // A depth pin opens its section with one item open: bring that item into view once the scene has settled.
    const timer = window.setTimeout(() => {
      const container = scroll.current, item = container?.querySelector<HTMLElement>("details[open]");
      if (!container || !item) return;
      const top = item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 72;
      container.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [stop.number, stop.openIndex, position]);
  // The stage shows one ayah at a time past three, so what it shows is what an opening paragraph need not repeat.
  const [picked, setPicked] = useState<{ number: number; key: string }>();
  const shown = stageShownKeys(stop.ayahKeys, picked?.number === stop.number ? picked.key : undefined);
  const sources = stop.recordIds.map((id) => reading.records[id]);
  return <>
      <header className="scene-topbar"><Button variant="quiet" onClick={onBack}><Icon icon={ArrowRight01Icon} />{reading.ui.reader.back}</Button><div className="scene-pips" aria-hidden="true">{stops.map((item) => <span key={item.number} data-state={item.number === stop.number ? "here" : stops.indexOf(item) < stops.indexOf(stop) ? "done" : "todo"} />)}</div><div className="scene-nav"><Button variant="round" size="icon" disabled={!previous} aria-label={reading.ui.reader.previous_stop} onClick={() => { if (previous) onNavigate(previous); }}><Icon icon={ArrowRight01Icon} /></Button><Button variant="round" size="icon" disabled={!next && !onClosing} aria-label={next ? reading.ui.reader.next_stop : reading.ui.summary.open} onClick={() => { if (next) onNavigate(next); else onClosing?.(); }}><Icon icon={ArrowLeft01Icon} /></Button></div></header>
      <div className="huda-scene-scroll" ref={scroll}><div key={stop.blockIndex} className={`huda-scene-body ${direction}`}>
        <AyahStage ayahs={stop.ayahKeys.map((key) => reading.ayahs.get(key)!)} ui={reading.ui} selected={shown[0]} onSelect={(key) => setPicked({ number: stop.number, key })} />
        <div className="scene-heading">{passage ? <p className="scene-kicker" data-run={`scene-passage-${passage.id}`}>{passage.title}<SourceMarker records={passage.records.map((id) => reading.records[id])} ui={reading.ui} onOpen={() => reading.onOpen(passage.records.map((id) => reading.records[id]))} /></p> : null}<DialogTitle asChild><h2 ref={heading} data-scene-heading tabIndex={-1} className={`huda-scene-title${stop.question ? " is-question" : ""}`}>{stop.sceneTitle ?? stop.title}</h2></DialogTitle></div>
        <div className="scene-reading"><ContinuousView blocks={stop.scene} showTitles={false} openIndex={stop.openIndex} stageKeys={stop.kind === "pin" ? undefined : shown} {...reading} /><AskedSection stop={stop.number} /><StopSources records={sources} ui={reading.ui} onOpen={reading.onOpen} /><FollowupsSection candidates={followups} promoted={promoted} />{!next && !onClosing && stop.kind !== "pin" && termsSummary ? <TermsSummary summary={termsSummary} ui={reading.ui} onOpen={reading.onOpen} /> : null}<AskDock /><NextCard next={next} previous={previous} nextPassage={nextPassage} nextSurah={nextSurah} closing={!next && onClosing ? onClosing : undefined} ui={reading.ui} records={reading.records} onOpen={reading.onOpen} onNext={() => { if (next) onNavigate(next); }} onPrevious={() => { if (previous) onNavigate(previous); }} onBack={onBack} /></div>
      </div></div>
  </>;
}
