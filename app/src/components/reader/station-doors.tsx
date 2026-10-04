"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import { StopDoor } from "./stop-door";

export type StationDoorsProps = { stops: SceneUnit[]; ui: Ui; visited: ReadonlySet<number>; onOpen: (stop: SceneUnit) => void };
type Row = { key: string; stop: SceneUnit; entering: boolean; leaving: boolean };
const keyOf = (stop: SceneUnit) => `${stop.kind ?? "stop"}:${stop.stationKey}:${stop.title}:${stop.kind ? stop.blockIndex : ""}`;
export function StationDoors({ stops, ui, visited, onOpen }: StationDoorsProps) {
  const [rows, setRows] = useState<Row[]>(() => stops.map((stop) => ({ key: keyOf(stop), stop, entering: false, leaving: false })));
  useEffect(() => {
    const desired = new Set(stops.map(keyOf));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRows((previous) => {
      const have = new Set(previous.filter((row) => !row.leaving).map((row) => row.key));
      const next = stops.map((stop) => ({ key: keyOf(stop), stop, entering: !reduced && !have.has(keyOf(stop)), leaving: false }));
      return reduced ? next : [...next, ...previous.filter((row) => !desired.has(row.key)).map((row) => ({ ...row, entering: false, leaving: true }))];
    });
    if (reduced) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => { secondFrame = window.requestAnimationFrame(() => setRows((previous) => previous.map((row) => ({ ...row, entering: false })))); });
    const timeout = window.setTimeout(() => setRows((previous) => previous.filter((row) => !row.leaving)), 320);
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); window.clearTimeout(timeout); };
  }, [stops]);
  return <>{rows.map((row, index) => <div className={`door-wrap${row.entering ? " is-entering" : ""}${row.leaving ? " is-leaving" : ""}`} key={row.key} inert={row.leaving || undefined} aria-hidden={row.leaving || undefined} style={{ "--door-delay": `${Math.min(index, 5) * 30}ms` } as CSSProperties}><div className="door-inner"><StopDoor stop={row.stop} seen={visited.has(row.stop.number)} ui={ui} onOpen={onOpen} /></div></div>)}</>;
}
