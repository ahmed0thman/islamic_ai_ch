"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpRight01Icon, BookOpen01Icon, PlusSignIcon, MinusSignIcon } from "@hugeicons/core-free-icons";
import type { SourceRecord, Ui } from "@/lib/types";
import { sortByCertainty, splitRulings } from "@/lib/rulings";
import { arabicDigits, numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceBadge } from "@/components/ui/source-badge";
import { SourceTypeBadge } from "@/components/ui/source-chip";
import { BottomSheet } from "./bottom-sheet";

export type SourceSheetProps = { records: SourceRecord[]; ui: Ui; term?: string; phrase?: string; onClose: () => void };
function EvidenceContent({ evidence, ui }: { evidence: SourceRecord["evidence"][number]; ui: Ui }) {
  const { rulings, takhrij } = splitRulings(evidence.rulings);
  return <article className="sheet-evidence" style={{ "--tone": ui.icons[evidence.icon].color } as CSSProperties}>
    <dl className="sheet-facts">
      <div><dt>{ui.panel.source}</dt><dd>{evidence.source_title}</dd></div>
      <div><dt>{ui.panel.author}</dt><dd>{evidence.author}</dd></div>
      <div><dt>{ui.panel.locator}</dt><dd>{arabicDigits(evidence.locator)}</dd></div>
    </dl>
    <div><p className="sheet-label">{ui.panel.quote}</p><blockquote className="sheet-evidence-quote">{evidence.quote}</blockquote></div>
    {rulings.map((ruling, rulingIndex) => <dl className="sheet-ruling sheet-facts" key={rulingIndex}>
      <div><dt>{ui.panel.ruling}</dt><dd>{ruling.text}</dd></div>
      <div><dt>{ui.panel.ruler}</dt><dd>{ruling.ruler}</dd></div>
    </dl>)}
    {takhrij.length ? <dl className="sheet-takhrij sheet-facts">
      <div><dt>{ui.panel.takhrij}</dt>{takhrij.map((item, itemIndex) => <dd key={itemIndex}>{item.text}{item.ruler ? <span className="sheet-takhrij-by">{item.ruler}</span> : null}</dd>)}</div>
    </dl> : null}
    {evidence.link_strength !== null ? <div className="sheet-link-strength"><p>{ui.link_strength[evidence.link_strength]}</p><p>{ui.link_strength.note}</p></div> : null}
    {evidence.url !== null ? <Button variant="primary" size="lg" asChild><a href={evidence.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{ui.panel.open_source}<Icon icon={ArrowUpRight01Icon} /></a></Button> : null}
  </article>;
}
function RecordContent({ record, ui }: { record: SourceRecord; ui: Ui }) {
  return <section className="sheet-record" aria-labelledby={`source-claim-${record.id}`}>
    <div className="sheet-record-types">{ui.icon_order.filter((kind) => record.icons.includes(kind)).map((kind) => <SourceTypeBadge key={kind} kind={kind} ui={ui} />)}</div>
    <p className="sheet-label">{ui.panel.claim}</p>
    <h3 className="sheet-claim" id={`source-claim-${record.id}`}>{record.claim}</h3>
    {/* The badge describes this record alone, so it sits here and never in the sheet's head. */}
    <div className="sheet-status">
      {record.state ? <><SourceBadge state={record.state} ui={ui} /><p>{ui.states[record.state].meaning}</p></> : null}
      {record.status_text.split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
      {record.badge ? <><SourceBadge kind={record.badge} ui={ui} /><p>{ui.badges[record.badge].meaning}</p></> : <p>{ui.panel.no_badge}</p>}
    </div>
    {record.evidence.map((evidence, index) => <EvidenceContent key={index} evidence={evidence} ui={ui} />)}
  </section>;
}
export function SourceSheet({ records: opened, ui, term, phrase, onClose }: SourceSheetProps) {
  const [showEvidence, setShowEvidence] = useState(!term);
  // Several records: the firmest opens first, the rest are folded away behind it.
  const records = useMemo(() => sortByCertainty(opened, ui.icon_order), [opened, ui.icon_order]);
  // The science the term belongs to: absent or an unknown key shows nothing.
  const scienceKey = records[0]?.science;
  const scienceName = term && scienceKey && ui.sciences && Object.hasOwn(ui.sciences, scienceKey) ? ui.sciences[scienceKey] : undefined;
  return <BottomSheet title={term ?? ui.panel.title} ui={ui} onClose={onClose} term={Boolean(term)}>
    {term ? <div className="term-definition"><p>{records[0]?.claim}</p>{scienceName ? <p className="science-chip"><span>{ui.panel.science_of}</span><b>{scienceName}</b></p> : null}<Button variant="pill" aria-expanded={showEvidence} aria-controls="term-evidence" onClick={() => setShowEvidence((value) => !value)}><Icon icon={BookOpen01Icon} />{ui.panel.source}</Button></div>
      : <div className="sheet-for">
        {phrase ? <><p className="sheet-label">{ui.panel.for_text}</p><blockquote className="sheet-for-text">{phrase}</blockquote></> : null}
        <p className="sheet-count">{ui.panel.sources_count}: <b>{numeral(records.length)}</b></p>
      </div>}
    {showEvidence ? <div id={term ? "term-evidence" : undefined}>
      {records.map((record, index) => index === 0 ? <RecordContent key={record.id} record={record} ui={ui} /> : <details key={record.id} className="sheet-more-record">
        <summary><span className="sheet-record-preview">{record.claim}</span><span className="detail-plus"><Icon icon={PlusSignIcon} /></span><span className="detail-minus"><Icon icon={MinusSignIcon} /></span></summary>
        <RecordContent record={record} ui={ui} />
      </details>)}
    </div> : null}
  </BottomSheet>;
}
