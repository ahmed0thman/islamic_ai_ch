"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { MapStop } from "@/lib/map";
import type { SurahSummary } from "@/lib/types";
import { ContentBlock, type ReadingProps } from "./reader";

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
    <div className="scene-pinned-ayahs"><ContentBlock block={{ type: "ayah", keys: stop.ayahKeys }} {...reading} /></div>
    <div className="scene-body">
      <button type="button" className="scene-map-button" onClick={onBack}><span aria-hidden="true">→</span>{reading.ui.reader.map_view}</button>
      <h2 className="scene-title" id="stop-scene-title" ref={heading} tabIndex={-1}>{stop.title}</h2>
      {stop.scene.map((block, index) => <ContentBlock key={index} block={block} showTitle={false} {...reading} />)}
      <nav className="scene-navigation">
        {previous ? <button type="button" className="scene-neighbour scene-previous" onClick={() => onNavigate(previous)}>
          <span><span className="scene-neighbour-label">{reading.ui.reader.previous_stop}</span><span>{previous.title}</span></span><span aria-hidden="true">→</span>
        </button> : null}
        {next ? <button type="button" className="scene-neighbour scene-next" onClick={() => onNavigate(next)}>
          <span><span className="scene-neighbour-label">{reading.ui.reader.next_stop}</span><span>{next.title}</span></span><span aria-hidden="true">←</span>
        </button> : nextSurah ? <Link className="scene-neighbour scene-next" href={`/s/${nextSurah.no}`} prefetch={false}>
          <span>{reading.ui.reader.next_surah}{" "}{nextSurah.name}</span><span aria-hidden="true">←</span>
        </Link> : null}
      </nav>
      <button type="button" className="scene-map-button scene-map-footer" onClick={onBack}>{reading.ui.reader.map_view}</button>
    </div>
  </section>;
}
