"use client";

import { useEffect, useState } from "react";
import type { Ayah, Ui } from "@/lib/types";
import { ayahWords, splitLastWord } from "@/lib/reading-text";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";

export type AyahStageProps = { ayahs: Ayah[]; ui: Ui; focusKey?: string };
export function AyahStage({ ayahs, ui, focusKey }: AyahStageProps) {
  const [selected, setSelected] = useState(ayahs[0]?.key);
  useEffect(() => { if (focusKey) setSelected(focusKey); }, [focusKey]);
  const current = ayahs.find((ayah) => ayah.key === selected) ?? ayahs[0];
  if (!current) return null;
  const visible = ayahs.length > 3 ? [current] : ayahs;
  return <section className="ayah-stage" aria-label={ui.reader.ayahs_title}>
    {visible.map((ayah) => {
      const [start, end] = splitLastWord(ayahWords(ayah.text));
      return <p className="stage-verse" data-ayah-key={ayah.key} key={ayah.key}>{start}<span className="claim-ending">{end}{"\u00a0"}<span className="ayah-gem">{numeral(ayah.no)}</span></span></p>;
    })}
    {ayahs.length > 3 ? <div className="stage-chips">{ayahs.map((ayah) => <Button key={ayah.key} variant="round" size="icon" aria-pressed={current.key === ayah.key} aria-label={`${ui.reader.ayahs_title} ${numeral(ayah.no)}`} onClick={() => setSelected(ayah.key)}>{numeral(ayah.no)}</Button>)}</div> : null}
  </section>;
}
