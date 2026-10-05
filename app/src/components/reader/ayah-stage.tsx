"use client";

import type { Ayah, Ui } from "@/lib/types";
import { ayahWords, splitLastWord } from "@/lib/reading-text";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";

/** With more than three ayahs the stage shows one at a time; `selected` and `onSelect` let the scene know which, so it can avoid repeating it. */
export function stageShownKeys(keys: string[], selected?: string): string[] {
  return keys.length > 3 ? [keys.includes(selected ?? "") ? selected! : keys[0]] : keys;
}
export type AyahStageProps = { ayahs: Ayah[]; ui: Ui; selected?: string; onSelect?: (key: string) => void };
export function AyahStage({ ayahs, ui, selected, onSelect }: AyahStageProps) {
  const current = ayahs.find((ayah) => ayah.key === selected) ?? ayahs[0];
  if (!current) return null;
  const visible = ayahs.length > 3 ? [current] : ayahs;
  return <section className="ayah-stage" aria-label={ui.reader.ayahs_title}>
    {visible.map((ayah) => {
      const [start, end] = splitLastWord(ayahWords(ayah.text));
      return <p className="stage-verse" data-ayah-key={ayah.key} key={ayah.key}>{start}<span className="claim-ending">{end}{"\u00a0"}<span className="ayah-gem">{numeral(ayah.no)}</span></span></p>;
    })}
    {ayahs.length > 3 ? <div className="stage-chips">{ayahs.map((ayah) => <Button key={ayah.key} variant="round" size="icon" aria-pressed={current.key === ayah.key} aria-label={`${ui.reader.ayahs_title} ${numeral(ayah.no)}`} onClick={() => onSelect?.(ayah.key)}>{numeral(ayah.no)}</Button>)}</div> : null}
  </section>;
}
