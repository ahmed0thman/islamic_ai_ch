"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { MapGroup } from "@/lib/map";
import type { SceneUnit } from "@/lib/depth-items";
import type { Surah, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceMarker } from "./source-marker";
import { StopDoor } from "./stop-door";

export type PassageOverviewProps = { groups: MapGroup[]; records: Surah["records"]; active: string | null; ui: Ui; onPick: (id: string) => void; onOpen: (records: Surah["records"][string][]) => void; onOpenStop: (stop: SceneUnit) => void; visited: ReadonlySet<number>; pins?: Record<string, SceneUnit[]> };
export function PassageOverview({ groups, records, active, ui, onPick, onOpen, onOpenStop, visited, pins = {} }: PassageOverviewProps) {
  return <section className="passage-overview" aria-label={ui.reader.passages_title}>
    <h2 className="sheet-label">{ui.reader.passages_title}</h2>
    {groups.map((group) => {
      if (!group.passage) return null;
      const passage = group.passage, sources = passage.records.map((id) => records[id]);
      return <div className="overview-passage" key={passage.id}><div className="overview-row"><Button variant="quiet" className="overview-pick" aria-expanded={active === passage.id} aria-controls={`overview-stops-${passage.id}`} onClick={() => onPick(passage.id)}><span>{passage.title}<small><bdi dir="ltr">{numeral(Number(passage.from.split(":")[1]))}–{numeral(Number(passage.to.split(":")[1]))}</bdi></small></span><Icon icon={ArrowLeft01Icon} /></Button><SourceMarker records={sources} ui={ui} onOpen={() => onOpen(sources)} /></div>
        <div className="overview-stops" id={`overview-stops-${passage.id}`} hidden={active !== passage.id}>{group.stations.flatMap((station): SceneUnit[] => [...station.stops, ...(pins[station.ayah.key] ?? [])]).map((stop) => <StopDoor key={`${stop.kind ?? "stop"}:${stop.blockIndex}`} stop={stop} seen={visited.has(stop.number)} ui={ui} onOpen={onOpenStop} />)}</div>
      </div>;
    })}
  </section>;
}
