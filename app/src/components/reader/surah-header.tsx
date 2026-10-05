"use client";

import type { ReactNode } from "react";
import type { Surah, SurahSummary, Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { numeral } from "@/lib/numerals";
import { ArrowRight01Icon, Bookmark01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceGlyph } from "@/components/ui/source-chip";
import { AppMenu } from "@/components/menu/app-menu";
import { LegendTrigger } from "./legend-trigger";

/** `onMap`: opens the map of this surah; given only when the reader is on a page above it (the continuous text), so the arrow is absent on the map itself. */
export type SurahHeaderProps = { surah: Surah; surahs: SurahSummary[]; scope: Scope; ui: Ui; onOpenUnit: () => void; onMap?: () => void };
export function SurahHeader({ surah, surahs, scope, ui, onOpenUnit, onMap }: SurahHeaderProps) {
  let unit: ReactNode = ui.reader.unit_whole;
  if (scope.kind === "ayah") unit = <>{ui.reader.unit_ayah} <bdi>{numeral(Number(scope.key.split(":")[1]))}</bdi></>;
  else if (scope.kind === "range") unit = <>{ui.reader.unit_ayahs} <bdi>{`${numeral(scope.from)}–${numeral(scope.to)}`}</bdi></>;
  else if (scope.kind === "passage") {
    const passage = surah.passages?.find((item) => item.id === scope.id);
    if (passage) unit = <bdi>{`${passage.title} ${numeral(Number(passage.from.split(":")[1]))}–${numeral(Number(passage.to.split(":")[1]))}`}</bdi>;
  }
  return <header className="surah-header">
    <div className="reader-appbar"><div className="reader-brand"><AppMenu ui={ui} current={surah.surah.no} ayahCount={surah.surah.ayah_count} />{onMap ? <Button variant="quiet" size="icon" aria-label={ui.reader.map_view} onClick={onMap}><Icon icon={ArrowRight01Icon} /></Button> : null}<span>{ui.app_name}</span></div><LegendTrigger ui={ui} /></div>
    <div className="surah-cover"><h1>{surah.surah.name}</h1><div className="cover-meta"><span className="cover-count" aria-label={`${ui.reader.ayahs_title}: ${numeral(surah.surah.ayah_count)}`}><b>{numeral(surah.surah.ayah_count)}</b><span aria-hidden="true"><SourceGlyph kind="ayah" size={20} /></span></span><p>{ui.tagline}</p></div><Button variant="pill" className="reading-unit-button" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpenUnit(); }}><Icon icon={Bookmark01Icon} /><span>{unit}</span></Button></div>
  </header>;
}
