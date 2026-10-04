"use client";

import { useEffect } from "react";
import type { MapStation, MapStop, SurahMapModel } from "@/lib/map";
import type { Ui } from "@/lib/types";
import { scopeContains, type Scope } from "@/lib/scope";
import { jumpToAyah } from "@/lib/reader-dom";
import { numeral } from "@/lib/numerals";
import { useReading } from "./reading-context";
import { AyahNode } from "./ayah-node";
import { PassageBar } from "./passage-bar";
import { PassageOverview } from "./passage-overview";
import { ContinuousView } from "./continuous-view";

export type SurahThreadProps = { map: SurahMapModel; ui: Ui; visited: ReadonlySet<number>; scope: Scope; currentStop: number | null; hidden?: boolean; onOpen: (stop: MapStop) => void; onScope: (scope: Scope) => void; onAyah?: (key: string) => void; animate?: boolean };
export function SurahThread({ map, ui, visited, scope, currentStop, hidden = false, onOpen, onScope, onAyah }: SurahThreadProps) {
  const reading = useReading();
  const passages = map.groups.flatMap((group) => group.passage ? [group.passage] : []);
  useEffect(() => {
    if (hidden || currentStop === null) return;
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".surah-thread .stop-door")).find((element) => element.dataset.stop === String(currentStop));
    button?.focus({ preventScroll: true });
  }, [hidden, currentStop]);
  function pickPassage(id: string) { onScope({ kind: "passage", id }); const passage = passages.find((item) => item.id === id); if (passage) jumpToAyah(passage.from); }
  function node(station: MapStation) {
    return <AyahNode key={station.ayah.key} station={station} scope={scope} dimmed={!scopeContains(station.ayah.key, scope, passages)} ui={ui} visited={visited} onOpen={onOpen} onScope={() => { if (onAyah) onAyah(station.ayah.key); else onScope({ kind: "ayah", key: station.ayah.key }); }} />;
  }
  return <div className="surah-thread" hidden={hidden}>
    {passages.length ? <PassageOverview groups={map.groups} records={reading.records} active={scope.kind === "passage" ? scope.id : null} ui={ui} visited={visited} onPick={pickPassage} onOpen={reading.onOpen} onOpenStop={onOpen} /> : null}
    <section className="thread-nodes" aria-label={ui.reader.map_view}>
      {map.groups.map((group) => {
        const rows: React.ReactNode[] = [];
        for (let index = 0; index < group.stations.length; index++) {
          const station = group.stations[index];
          if (group.stations.length > 12 && !station.stops.length) {
            const empty = [station];
            while (index + 1 < group.stations.length && !group.stations[index + 1].stops.length) empty.push(group.stations[++index]);
            rows.push(<details className="thread-ayah-range" key={station.ayah.key}><summary>{ui.reader.ayahs_title} <bdi dir="ltr">{numeral(empty[0].ayah.no)}–{numeral(empty.at(-1)!.ayah.no)}</bdi></summary>{empty.map(node)}</details>);
          } else rows.push(node(station));
        }
        return <section className="thread-group" key={group.passage?.id ?? "surah"}>{group.passage ? <PassageBar passage={group.passage} records={group.passage.records.map((id) => reading.records[id])} selected={scope.kind === "passage" && scope.id === group.passage.id} ui={ui} onScope={() => pickPassage(group.passage!.id)} onOpen={reading.onOpen} /> : null}{rows}</section>;
      })}
    </section>
    {map.unassignedBlocks.some((block) => block.type === "paragraph" || block.type === "details") ? <div className="thread-unassigned"><ContinuousView blocks={map.unassignedBlocks.filter((block) => block.type !== "ayah")} {...reading} /></div> : null}
  </div>;
}
