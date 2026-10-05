"use client";

import { useId } from "react";
import type { SourceRecord, Ui } from "@/lib/types";
import type { TermsSummary as Summary } from "@/lib/terms-summary";
import { arabicDigits } from "@/lib/numerals";
import type { SourceOptions } from "./sheet-provider";

export type TermsSummaryProps = { summary: Summary; ui: Ui; hidden?: boolean; onOpen: (records: SourceRecord[], options?: SourceOptions) => void };
/** The terms of the level the reader has just read, grouped under the science each belongs to. Computed from the level's `term` segments, never from what the reader did. */
export function TermsSummary({ summary, ui, hidden = false, onOpen }: TermsSummaryProps) {
  const titleId = useId();
  const labels = ui.terms_summary;
  return <section className="terms-summary" aria-labelledby={titleId} hidden={hidden}>
    <h2 id={titleId} className="terms-summary-title">{labels.title}</h2>
    <p className="terms-summary-count"><span>{labels.terms}: <b>{arabicDigits(String(summary.termCount))}</b></span>{summary.scienceCount ? <><span className="terms-summary-divider" aria-hidden="true" /><span>{labels.sciences}: <b>{arabicDigits(String(summary.scienceCount))}</b></span></> : null}</p>
    {summary.groups.map((group) => <div className="terms-group" key={group.science ?? "other"}>
      <h3 className="terms-group-title">{group.science === null ? labels.other : ui.sciences![group.science]}</h3>
      <ul className="terms-chips">{group.terms.map((term) => <li key={term.record.id}>
        <button className="term-chip" type="button" aria-haspopup="dialog" aria-label={`${ui.reader.open_term}: ${term.text}`}
          onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen([term.record], { term: term.text }); }}>{term.text}</button>
      </li>)}</ul>
    </div>)}
  </section>;
}
