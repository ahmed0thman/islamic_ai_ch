"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import type { Passage, SourceRecord, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceMarker } from "./source-marker";

export type PassageBarProps = { passage: Passage; records: SourceRecord[]; selected: boolean; ui: Ui; onScope: () => void; onOpen: (records: SourceRecord[]) => void };
export function PassageBar({ passage, records, selected, ui, onScope, onOpen }: PassageBarProps) {
  return <header className="passage-bar"><span className="passage-node" aria-hidden="true" /><div><h3 className="passage-title" data-run={`passage:${passage.id}`}>{passage.title}<SourceMarker records={records} ui={ui} onOpen={() => onOpen(records)} /></h3><p className="passage-range"><bdi dir="ltr">{numeral(Number(passage.from.split(":")[1]))}–{numeral(Number(passage.to.split(":")[1]))}</bdi></p></div><Button variant="round" size="icon" aria-pressed={selected} aria-label={`${ui.reader.passages_title}: ${passage.title}`} onClick={onScope}><Icon icon={PlayIcon} /></Button></header>;
}
