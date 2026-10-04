"use client";

import { useRef, useState } from "react";
import { PlayIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Surah, Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { numeral } from "@/lib/numerals";
import { ayahWords } from "@/lib/reading-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "./bottom-sheet";

export type ReadingUnitSheetProps = { surah: Surah; scope: Scope; ui: Ui; onChoose: (scope: Scope) => void; onClose: () => void };
export function ReadingUnitSheet({ surah, scope, ui, onChoose, onClose }: ReadingUnitSheetProps) {
  const ayahs = surah.ayahs.filter((ayah) => ayah.key.startsWith(`${surah.surah.no}:`)).sort((a, b) => a.no - b.no);
  const start = scope.kind === "range" ? scope.from : scope.kind === "ayah" ? Number(scope.key.split(":")[1]) : ayahs[0]?.no ?? 1;
  const [from, setFrom] = useState(start), [to, setTo] = useState(scope.kind === "range" ? scope.to : start);
  const pending = useRef<Scope | null>(null);
  return <BottomSheet title={surah.surah.name} ui={ui} onClose={() => { onClose(); if (pending.current) onChoose(pending.current); }}>
    {(dismiss) => {
      const choose = (next: Scope) => { pending.current = next; dismiss(); };
      return <div className="reading-unit-sheet"><Button variant="pill" className="whole-surah-choice" onClick={() => choose({ kind: "surah" })}><Icon icon={PlayIcon} />{surah.surah.name}</Button>
        {surah.passages?.length ? <section><h3>{ui.reader.passages_title}</h3>{surah.passages.map((passage) => <Button className="unit-passage-choice" variant="quiet" key={passage.id} onClick={() => choose({ kind: "passage", id: passage.id })}><span>{passage.title}<small><bdi dir="ltr">{numeral(Number(passage.from.split(":")[1]))}–{numeral(Number(passage.to.split(":")[1]))}</bdi></small></span><Icon icon={ArrowLeft01Icon} /></Button>)}</section> : null}
        <section className="unit-range"><h3>{ui.reader.range}</h3><div className="unit-range-controls"><label><span className="sheet-label">{ui.reader.ayahs_title}</span><select aria-label={`${ui.reader.ayahs_title}: ${numeral(from)}`} value={from} onChange={(event) => setFrom(Number(event.target.value))}>{ayahs.map((ayah) => <option value={ayah.no} key={ayah.key}>{numeral(ayah.no)}</option>)}</select></label><span aria-hidden="true">–</span><label><span className="sheet-label">{ui.reader.ayahs_title}</span><select aria-label={`${ui.reader.ayahs_title}: ${numeral(to)}`} value={to} onChange={(event) => setTo(Number(event.target.value))}>{ayahs.map((ayah) => <option value={ayah.no} key={ayah.key}>{numeral(ayah.no)}</option>)}</select></label><Button variant="round" size="icon" aria-label={ui.reader.read_this} disabled={from > to} onClick={() => choose({ kind: "range", from, to })}><Icon icon={PlayIcon} /></Button></div></section>
        <section><h3>{ui.reader.ayahs_title}</h3><div className="unit-ayah-list">{ayahs.map((ayah) => <button type="button" className="unit-ayah-choice" key={ayah.key} onClick={() => choose({ kind: "ayah", key: ayah.key })}><span className="unit-ayah-number">{numeral(ayah.no)}</span><span>{ayahWords(ayah.text)}</span><Icon icon={ArrowLeft01Icon} /></button>)}</div></section>
      </div>;
    }}
  </BottomSheet>;
}
