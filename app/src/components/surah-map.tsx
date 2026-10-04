"use client";

import { useEffect, useRef, useState } from "react";
import type { MapStop, SurahMapModel } from "@/lib/map";
import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { AyahText } from "./reader";
import { Icon } from "./marks";
import "@/app/map.css";

export function SurahMap({ map, ui, visited, currentStop, hidden = false, onOpen }: {
  map: SurahMapModel;
  ui: Ui;
  visited: ReadonlySet<number>;
  currentStop: number | null;
  hidden?: boolean;
  onOpen: (stop: MapStop) => void;
}) {
  const [openPassages, setOpenPassages] = useState(() => new Set(
    map.groups.filter((_, index) => map.stops.length <= 12 || index === 0)
      .flatMap((group) => group.passage ? [group.passage.id] : []),
  ));
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());

  function enterStation(number: number) {
    const button = buttons.current.get(number);
    button?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    button?.focus({ preventScroll: true });
    setHighlighted(number);
  }

  useEffect(() => {
    if (highlighted === null) return;
    const timeout = window.setTimeout(() => setHighlighted(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [highlighted]);

  // Returning to a scene's card also opens its passage and restores keyboard focus.
  useEffect(() => {
    if (hidden || currentStop === null) return;
    const passage = map.stops.find((stop) => stop.number === currentStop)?.passage;
    if (passage) setOpenPassages((previous) => new Set(previous).add(passage));
    const frame = window.requestAnimationFrame(() => {
      const button = buttons.current.get(currentStop);
      button?.scrollIntoView({ block: "center", behavior: "auto" });
      button?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hidden, currentStop, map]);

  return <section className="surah-map" hidden={hidden} aria-label={ui.reader.map_view}>
    {map.groups.some((group) => group.passage) ? <h2 className="map-passages-title">{ui.reader.passages_title}</h2> : null}
    {map.groups.map((group, index) => {
      const passage = group.passage;
      const open = !passage || openPassages.has(passage.id);
      const sectionId = `map-passage-${index}`;
      return <section key={passage?.id ?? "surah"} className="map-group" aria-label={passage?.title}>
        {passage ? <h3 className="map-passage-heading"><button type="button" className="map-passage-button"
          aria-expanded={open} aria-controls={sectionId} onClick={() => setOpenPassages((previous) => {
            const next = new Set(previous);
            if (next.has(passage.id)) next.delete(passage.id); else next.add(passage.id);
            return next;
          })}>
          <span className="map-passage-dot" aria-hidden="true" />
          <span className="map-passage-content"><span>{passage.title}</span>
            <span className="map-passage-range">{ui.reader.ayahs_title}{" "}<bdi>{numeral(Number(passage.from.split(":")[1]))}{"–"}{numeral(Number(passage.to.split(":")[1]))}</bdi></span>
          </span>
          <span className="map-disclosure" aria-hidden="true">{open ? "−" : "+"}</span>
        </button></h3> : null}
        <div className="map-line" id={sectionId} hidden={!open}>
          {group.stations.map((station) => <section className="map-station" key={station.ayah.key}>
            {station.stops.length ? <button type="button" className="map-station-button" onClick={() => enterStation(station.stops[0].number)}>
              <span className="map-station-dot" aria-hidden="true" /><AyahText ayah={station.ayah} />
            </button> : <div className="map-station-button">
              <span className="map-station-dot" aria-hidden="true" /><AyahText ayah={station.ayah} />
            </div>}
            {station.stops.length ? <ul className="map-branches">
              {station.stops.map((stop) => <li key={stop.blockIndex} className={stop.icons.includes("hidaya") ? "map-branch has-hidaya" : "map-branch"}>
                <button type="button" ref={(button) => {
                  if (button) buttons.current.set(stop.number, button); else buttons.current.delete(stop.number);
                }} className={[
                  "map-stop", stop.icons.includes("link") ? "is-cross-link" : "",
                  stop.icons.includes("hidaya") ? "is-hidaya" : "",
                  visited.has(stop.number) ? "is-visited" : "",
                  currentStop === stop.number ? "is-current" : "",
                  highlighted === stop.number ? "is-highlighted" : "",
                ].filter(Boolean).join(" ")}
                  aria-label={[stop.title, ...ui.icon_order.filter((kind) => stop.icons.includes(kind)).map((kind) => ui.icons[kind].label)].join(" — ")}
                  aria-current={currentStop === stop.number ? "step" : undefined} onClick={() => onOpen(stop)}>
                  <span className="map-stop-icons" aria-hidden="true">{ui.icon_order.filter((kind) => stop.icons.includes(kind)).map((kind) =>
                    <span key={kind} className={kind === "hidaya" ? "map-hidaya-dot" : undefined}><Icon kind={kind} ui={ui} /></span>,
                  )}</span>
                  <span className="map-stop-title">{stop.title}</span>
                </button>
              </li>)}
            </ul> : null}
          </section>)}
        </div>
      </section>;
    })}
  </section>;
}
