"use client";

import { useEffect } from "react";
import type { MapStation, SurahMapModel } from "@/lib/map";
import type { DepthItemsModel, SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import { scopeContains, type Scope } from "@/lib/scope";
import { jumpToAyah } from "@/lib/reader-dom";
import { numeral } from "@/lib/numerals";
import { useReading } from "./reading-context";
import { AyahNode } from "./ayah-node";
import { PassageBar } from "./passage-bar";
import { PassageOverview } from "./passage-overview";
import { StationDoors } from "./station-doors";
import { ContinuousView } from "./continuous-view";

export type SurahThreadProps = { map: SurahMapModel; ui: Ui; visited: ReadonlySet<number>; scope: Scope; currentStop: number | null; hidden?: boolean; items?: DepthItemsModel; onOpen: (stop: SceneUnit) => void; onScope: (scope: Scope) => void; onAyah?: (key: string) => void; animate?: boolean };
export function SurahThread({ map, ui, visited, scope, currentStop, hidden = false, items, onOpen, onScope, onAyah }: SurahThreadProps) {
  const reading = useReading();
  const passages = map.groups.flatMap((group) => group.passage ? [group.passage] : []);
  const hasItems = Boolean(items?.units.length);
  const pins: Record<string, SceneUnit[]> = {};
  for (const pin of items?.pins ?? []) (pins[pin.stationKey] ??= []).push(pin);
  useEffect(() => {
    if (hidden || currentStop === null) return;
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".surah-thread .stop-door")).find((element) => element.dataset.stop === String(currentStop));
    button?.focus({ preventScroll: true });
  }, [hidden, currentStop]);
  function pickPassage(id: string) { onScope({ kind: "passage", id }); const passage = passages.find((item) => item.id === id); if (passage) jumpToAyah(passage.from); }
  function node(station: MapStation) {
    return <AyahNode key={station.ayah.key} station={station} scope={scope} dimmed={!scopeContains(station.ayah.key, scope, passages)} ui={ui} visited={visited} onOpen={onOpen} onScope={() => { if (onAyah) onAyah(station.ayah.key); else onScope({ kind: "ayah", key: station.ayah.key }); }}>{hasItems ? <StationDoors stops={pins[station.ayah.key] ?? []} visited={visited} ui={ui} onOpen={onOpen} /> : undefined}</AyahNode>;
  }
  return <div className="surah-thread" hidden={hidden}>
    {passages.length ? <PassageOverview groups={map.groups} records={reading.records} active={scope.kind === "passage" ? scope.id : null} ui={ui} visited={visited} pins={pins} onPick={pickPassage} onOpen={reading.onOpen} onOpenStop={onOpen} /> : null}
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
    {hasItems && items!.shelf.length ? <div className="thread-shelf"><StationDoors stops={items!.shelf} visited={visited} ui={ui} onOpen={onOpen} /><div className="shelf-end" aria-hidden="true">{ui.icons.ayah.symbol}</div></div> : null}
    {!hasItems && map.unassignedBlocks.some((block) => block.type === "paragraph" || block.type === "details") ? <div className="thread-unassigned"><ContinuousView blocks={map.unassignedBlocks.filter((block) => block.type !== "ayah")} {...reading} /></div> : null}
  </div>;
}
