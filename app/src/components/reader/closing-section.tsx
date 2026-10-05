"use client";

import type { Ref } from "react";
import type { SceneUnit } from "@/lib/depth-items";
import type { ClosingPart } from "@/lib/closing";
import type { ParagraphBlock, SurahSummary } from "@/lib/types";
import type { TermsSummary as Summary } from "@/lib/terms-summary";
import { numeral } from "@/lib/numerals";
import { DialogTitle } from "@/components/ui/dialog";
import type { ReadingProps } from "./reading-context";
import { ParagraphView } from "./paragraph-view";
import { TermsSummary } from "./terms-summary";
import { NextCard } from "./next-card";

export type ClosingSectionProps = ReadingProps & {
  surahName: string; summary: ParagraphBlock; parts: ClosingPart<SceneUnit>[]; termsSummary?: Summary | null; nextSurah?: SurahSummary;
  /** A part leads to the first stop of its passage. */
  onPart: (unit: SceneUnit) => void;
  /** Absent in the continuous text, where there is no stop to go back to. */
  previous?: SceneUnit; onPrevious?: () => void; onMap?: () => void;
  /** Set on the closing screen: its title is the dialog's title and takes focus on open. In the continuous text it is a plain heading. */
  headingRef?: Ref<HTMLHeadingElement>;
};
/**
 * The surah in one look: the unified view of the surah (the owner's note, 5 October). The same section closes the closing screen
 * and the continuous text. Everything on it comes from the content: the title and labels from the dictionary, the parts from the passages,
 * the summary from the level's closing paragraph. It is never a stop and never counts as one.
 */
export function ClosingSection({ surahName, summary, parts, termsSummary, nextSurah, onPart, previous, onPrevious, onMap, headingRef, ...reading }: ClosingSectionProps) {
  const { ui } = reading;
  const title = <h2 className="closing-title" ref={headingRef} tabIndex={headingRef ? -1 : undefined} data-scene-heading={headingRef ? "" : undefined}>{ui.summary.title}</h2>;
  return <section className="closing">
    <header className="closing-head"><p className="closing-surah">{surahName}</p>{headingRef ? <DialogTitle asChild>{title}</DialogTitle> : title}</header>
    {parts.length ? <div className="closing-parts"><h3 className="sheet-label">{ui.summary.parts}</h3>
      <ol className="closing-parts-list">{parts.map(({ passage, unit }) => {
        const content = <><span className="closing-part-dot" aria-hidden="true" /><span className="closing-part-text"><span className="closing-part-range"><bdi dir="ltr">{numeral(Number(passage.from.split(":")[1]))}–{numeral(Number(passage.to.split(":")[1]))}</bdi></span><span className="closing-part-title">{passage.title}</span></span></>;
        return <li key={passage.id}>{unit
          ? <button type="button" className="closing-part" data-passage={passage.id} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onPart(unit); }}>{content}</button>
          : <div className="closing-part is-static">{content}</div>}</li>;
      })}</ol></div> : null}
    <div className="closing-summary"><ParagraphView block={summary} runPrefix="closing-summary" {...reading} /></div>
    {termsSummary ? <TermsSummary summary={termsSummary} ui={ui} onOpen={reading.onOpen} /> : null}
    <NextCard nextSurah={nextSurah} previous={previous} records={reading.records} onOpen={reading.onOpen} onPrevious={onPrevious} onBack={onMap} ui={ui} />
  </section>;
}
