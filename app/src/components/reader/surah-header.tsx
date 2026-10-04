"use client";

import Link from "next/link";
import type { Surah, SurahSummary, Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { numeral } from "@/lib/numerals";
import { ArrowRight01Icon, Bookmark01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceGlyph } from "@/components/ui/source-chip";
import { LegendTrigger } from "./legend-trigger";
import { SurahSwitcher } from "./surah-switcher";

export type SurahHeaderProps = { surah: Surah; surahs: SurahSummary[]; scope: Scope; ui: Ui; onOpenUnit: () => void };
export function SurahHeader({ surah, surahs, scope, ui, onOpenUnit }: SurahHeaderProps) {
  let unit = "";
  if (scope.kind === "ayah") unit = numeral(Number(scope.key.split(":")[1]));
  else if (scope.kind === "range") unit = `${numeral(scope.from)}–${numeral(scope.to)}`;
  else if (scope.kind === "passage") {
    const passage = surah.passages?.find((item) => item.id === scope.id);
    if (passage) unit = `${passage.title} ${numeral(Number(passage.from.split(":")[1]))}–${numeral(Number(passage.to.split(":")[1]))}`;
  }
  return <header className="surah-header">
    <div className="reader-appbar"><div className="reader-brand"><Button asChild variant="quiet" size="icon"><Link href="/" prefetch={false} aria-label={ui.reader.back}><Icon icon={ArrowRight01Icon} /></Link></Button><span>{ui.app_name}</span></div><LegendTrigger ui={ui} /></div>
    <div className="surah-cover"><h1>{surah.surah.name}</h1><div className="cover-meta"><span className="cover-count" aria-label={`${ui.reader.ayahs_title}: ${numeral(surah.surah.ayah_count)}`}><b>{numeral(surah.surah.ayah_count)}</b><span aria-hidden="true"><SourceGlyph kind="ayah" size={20} /></span></span><p>{ui.tagline}</p></div><Button variant="pill" className="reading-unit-button" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpenUnit(); }}><Icon icon={Bookmark01Icon} /><span>{surah.surah.name}{unit ? <> · <bdi>{unit}</bdi></> : null}</span></Button><SurahSwitcher surahs={surahs} current={surah.surah.no} ui={ui} /></div>
  </header>;
}
