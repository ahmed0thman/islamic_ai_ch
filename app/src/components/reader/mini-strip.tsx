"use client";

import { isLongSurah, type MapGroup } from "@/lib/map";
import type { Scope } from "@/lib/scope";
import { scopeContains } from "@/lib/scope";
import { numeral } from "@/lib/numerals";

export type MiniStripProps = { groups: MapGroup[]; depthPins: Record<string, number>; itemPins?: Record<string, number>; current: string | null; scope: Scope; onJump: (key: string) => void; onScope: (scope: Scope) => void; ariaLabel: string };
export function MiniStrip({ groups, depthPins, itemPins = {}, current, scope, onJump, onScope, ariaLabel }: MiniStripProps) {
  const total = groups.reduce((sum, group) => sum + group.stations.length, 0);
  const compact = isLongSurah(total);
  const tracks = groups.flatMap((group, index) => [...(index ? ["var(--space-xs)"] : []), ...group.stations.map(() => "minmax(0,1fr)")]);
  const passages = groups.flatMap((group) => group.passage ? [group.passage] : []);
  let column = 1;
  let currentColumn = 0;
  return <nav className={`mini-strip${compact ? " is-compact" : ""}`} aria-label={ariaLabel}><div className="mini-grid" style={{ gridTemplateColumns: tracks.join(" ") }}>
    {groups.map((group, index) => {
      if (index) column++;
      const start = column; column += group.stations.length;
      group.stations.forEach((station, stationIndex) => { if (station.ayah.key === current) currentColumn = start + stationIndex; });
      return <div className="mini-group" key={group.passage?.id ?? "surah"}>
        {group.passage ? <button type="button" className="mini-rail" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-label={group.passage.title} aria-pressed={scope.kind === "passage" && scope.id === group.passage.id} onClick={() => onScope({ kind: "passage", id: group.passage!.id })}><span style={{ background: `color-mix(in srgb,var(--accent) ${16 + Math.min(index, 2) * 14}%,var(--surface-2))` }} /></button> : <span className="mini-rail is-plain" style={{ gridColumn: `${start} / span ${group.stations.length}` }} aria-hidden="true" />}
        {compact ? null : group.stations.map((station, stationIndex) => <button key={station.ayah.key} type="button" className={`mini-bead-control${scopeContains(station.ayah.key, scope, passages) ? "" : " is-dimmed"}${scope.kind === "ayah" && scope.key === station.ayah.key ? " is-selected" : ""}`} style={{ gridColumn: start + stationIndex }} aria-label={`${ariaLabel} ${numeral(station.ayah.no)}`} aria-current={current === station.ayah.key ? "true" : undefined} onClick={() => onJump(station.ayah.key)}>
          <span className="mini-bead">{numeral(station.ayah.no)}</span><span className="mini-pins" aria-hidden="true">{Array.from({ length: depthPins[station.ayah.key] ?? 0 }, (_, pin) => <span key={`stop-${pin}`} />)}{Array.from({ length: itemPins[station.ayah.key] ?? 0 }, (_, pin) => <span className="is-depth-pin" key={`item-${pin}`} />)}</span>
        </button>)}
      </div>;
    })}
    {compact && currentColumn ? <span className="mini-here" style={{ gridColumn: currentColumn }} aria-hidden="true" /> : null}
  </div></nav>;
}
