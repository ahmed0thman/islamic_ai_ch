"use client";

import type { MapGroup } from "@/lib/map";
import type { Scope } from "@/lib/scope";
import { scopeContains } from "@/lib/scope";
import { numeral } from "@/lib/numerals";

export type MiniStripProps = { groups: MapGroup[]; depthPins: Record<string, number>; current: string | null; scope: Scope; onJump: (key: string) => void; onScope: (scope: Scope) => void; ariaLabel: string };
export function MiniStrip({ groups, depthPins, current, scope, onJump, onScope, ariaLabel }: MiniStripProps) {
  const tracks = groups.flatMap((group, index) => [...(index ? [".375rem"] : []), ...group.stations.map(() => "minmax(var(--control-height),1fr)")]);
  const passages = groups.flatMap((group) => group.passage ? [group.passage] : []);
  let column = 1;
  return <nav className="mini-strip" aria-label={ariaLabel}><div className="mini-grid" style={{ gridTemplateColumns: tracks.join(" ") }}>
    {groups.map((group, index) => {
      if (index) column++;
      const start = column; column += group.stations.length;
      return <div className="mini-group" key={group.passage?.id ?? "surah"}>
        {group.passage ? <button type="button" className="mini-rail" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-label={group.passage.title} aria-pressed={scope.kind === "passage" && scope.id === group.passage.id} onClick={() => onScope({ kind: "passage", id: group.passage!.id })}><span style={{ background: `color-mix(in srgb,var(--accent) ${16 + Math.min(index, 2) * 14}%,var(--surface-2))` }} /></button> : <span className="mini-rail is-plain" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-hidden="true" />}
        {group.stations.map((station, stationIndex) => <button key={station.ayah.key} type="button" className={`mini-bead-control${scopeContains(station.ayah.key, scope, passages) ? "" : " is-dimmed"}`} style={{ gridColumn: start + stationIndex }} aria-label={`${ariaLabel} ${numeral(station.ayah.no)}`} aria-current={current === station.ayah.key ? "true" : undefined} onClick={() => onJump(station.ayah.key)}>
          <span className="mini-bead">{numeral(station.ayah.no)}</span><span className="mini-pins" aria-hidden="true">{Array.from({ length: depthPins[station.ayah.key] ?? 0 }, (_, pin) => <span key={pin} />)}</span>
        </button>)}
      </div>;
    })}
  </div></nav>;
}
