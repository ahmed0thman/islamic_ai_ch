"use client";

import Link from "next/link";
import { ArrowLeft01Icon, ArrowRight01Icon, MapsIcon } from "@hugeicons/core-free-icons";
import type { SceneUnit } from "@/lib/depth-items";
import type { Passage, SourceRecord, SurahSummary, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceMarker } from "./source-marker";

export type NextCardProps = { next?: SceneUnit; previous?: SceneUnit; nextPassage?: Passage; nextSurah?: SurahSummary; records: Record<string, SourceRecord>; onOpen: (records: SourceRecord[]) => void; onNext: () => void; onPrevious: () => void; onBack: () => void; ui: Ui };
export function NextCard({ next, previous, nextPassage, nextSurah, records, onOpen, onNext, onPrevious, onBack, ui }: NextCardProps) {
  const passageSources = nextPassage?.records.map((id) => records[id]) ?? [];
  return <nav className="onward">
    {nextPassage ? <div className="passage-continuation"><p data-run={`passage-next:${nextPassage.id}`}>{nextPassage.title}<SourceMarker records={passageSources} ui={ui} onOpen={() => onOpen(passageSources)} /></p><p className="sheet-label"><bdi dir="ltr">{numeral(Number(nextPassage.from.split(":")[1]))}–{numeral(Number(nextPassage.to.split(":")[1]))}</bdi></p></div> : null}
    {next ? <Button variant="primary" className="next-card" onClick={onNext}><span><small>{ui.reader.next_stop}</small><strong>{next.title}</strong></span><span className="next-go"><Icon icon={ArrowLeft01Icon} size={24} /></span></Button>
      : nextSurah ? <Button variant="primary" className="next-card" asChild><Link href={`/s/${nextSurah.no}/`} prefetch={false}><span><small>{ui.reader.next_surah}</small><strong>{nextSurah.name}</strong></span><span className="next-go"><Icon icon={ArrowLeft01Icon} size={24} /></span></Link></Button> : null}
    <div className="onward-alternatives">{previous ? <Button variant="quiet" onClick={onPrevious}><Icon icon={ArrowRight01Icon} />{ui.reader.previous_stop}</Button> : null}<Button variant="quiet" onClick={onBack}><Icon icon={MapsIcon} />{ui.reader.map_view}</Button></div>
  </nav>;
}
