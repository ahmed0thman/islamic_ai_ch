"use client";

import Link from "next/link";
import { ArrowRight01Icon, ArrowLeft01Icon, MapsIcon } from "@hugeicons/core-free-icons";
import { Icon } from "./ui/icon";
import { Button } from "./ui/button";
import { useEffect, useRef } from "react";
import type { MapStop } from "@/lib/map";
import type { SurahSummary } from "@/lib/types";
import { ContinuousView } from "./reader/continuous-view";
import type { ReadingProps } from "./reader/reading-context";

export function StopScene({ stop, previous, next, nextSurah, onNavigate, onBack, ...reading }: ReadingProps & {
  stop: MapStop;
  previous?: MapStop;
  next?: MapStop;
  nextSurah?: SurahSummary;
  onNavigate: (stop: MapStop) => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest(".stop-scene")?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [stop.number]);

  return <section className="stop-scene" aria-labelledby="stop-scene-title">
    <div className="scene-pinned-ayahs"><ContinuousView blocks={[{ type: "ayah", keys: stop.ayahKeys }]} {...reading} /></div>
    <div className="scene-body">
      <Button variant="quiet" className="scene-map-button" onClick={onBack}><Icon icon={ArrowRight01Icon} />{reading.ui.reader.map_view}</Button>
      <h2 className="scene-title" id="stop-scene-title" ref={heading} tabIndex={-1}>{stop.title}</h2>
      <ContinuousView blocks={stop.scene} showTitles={false} {...reading} />
      <nav className="scene-navigation">
        {previous ? <Button variant="quiet" className="scene-neighbour scene-previous" onClick={() => onNavigate(previous)}>
          <span><span className="scene-neighbour-label">{reading.ui.reader.previous_stop}</span><span>{previous.title}</span></span><Icon icon={ArrowRight01Icon} />
        </Button> : null}
        {next ? <Button variant="quiet" className="scene-neighbour scene-next" onClick={() => onNavigate(next)}>
          <span><span className="scene-neighbour-label">{reading.ui.reader.next_stop}</span><span>{next.title}</span></span><Icon icon={ArrowLeft01Icon} />
        </Button> : nextSurah ? <Link className="scene-neighbour scene-next" href={`/s/${nextSurah.no}`} prefetch={false}>
          <span>{reading.ui.reader.next_surah}{" "}{nextSurah.name}</span><Icon icon={ArrowLeft01Icon} />
        </Link> : null}
      </nav>
      <Button variant="quiet" className="scene-map-button scene-map-footer" onClick={onBack}><Icon icon={MapsIcon} />{reading.ui.reader.map_view}</Button>
    </div>
  </section>;
}
