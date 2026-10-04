"use client";

import type { ReactNode } from "react";
import type { MapStation } from "@/lib/map";
import type { SceneUnit } from "@/lib/depth-items";
import type { Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { ayahWords } from "@/lib/reading-text";
import { numeral } from "@/lib/numerals";
import { StationDoors } from "./station-doors";

export type AyahNodeProps = { station: MapStation; scope: Scope; dimmed: boolean; ui: Ui; onScope: () => void; onOpen: (stop: SceneUnit) => void; visited: ReadonlySet<number>; children?: ReactNode };
export function AyahNode({ station, scope, dimmed, ui, onScope, onOpen, visited, children }: AyahNodeProps) {
  return <section className={`ayah-node${dimmed ? " is-dimmed" : ""}`} data-station-key={station.ayah.key}>
    <button type="button" className="ayah-medal" aria-haspopup="dialog" aria-label={`${ui.reader.range}: ${ui.reader.ayahs_title} ${numeral(station.ayah.no)}`} aria-pressed={scope.kind === "ayah" && scope.key === station.ayah.key} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onScope(); }}>{numeral(station.ayah.no)}</button>
    <div className="ayah-node-body"><p className="thread-verse" data-ayah-key={station.ayah.key}>{ayahWords(station.ayah.text)}</p><div className="station-doors">{children ?? <StationDoors stops={station.stops} visited={visited} ui={ui} onOpen={onOpen} />}</div></div>
  </section>;
}
