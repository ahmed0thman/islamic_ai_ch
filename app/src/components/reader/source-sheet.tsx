"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { LinkSquare02Icon, BookOpen01Icon, PlusSignIcon, MinusSignIcon } from "@hugeicons/core-free-icons";
import type { SourceRecord, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceBadge } from "@/components/ui/source-badge";
import { BottomSheet } from "./bottom-sheet";

export type SourceSheetProps = { records: SourceRecord[]; ui: Ui; term?: string; onClose: () => void };
function RecordContent({ record, ui }: { record: SourceRecord; ui: Ui }) {
  return <section className="sheet-record" aria-labelledby={`source-claim-${record.id}`}>
    <p className="sheet-label">{ui.panel.claim}</p>
    <h3 className="sheet-claim" id={`source-claim-${record.id}`}>{record.claim}</h3>
    <div className="sheet-status">
      {record.badge ? <><SourceBadge kind={record.badge} ui={ui} /><p>{ui.badges[record.badge].meaning}</p></> : <p>{ui.panel.no_badge}</p>}
      {record.status_text.split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
    </div>
    {record.evidence.map((evidence, index) => <article key={index} className="sheet-evidence" style={{ "--tone": ui.icons[evidence.icon].color } as CSSProperties}>
      <dl className="sheet-facts">
        <div><dt>{ui.panel.source}</dt><dd>{evidence.source_title}</dd></div>
        <div><dt>{ui.panel.author}</dt><dd>{evidence.author}</dd></div>
        <div><dt>{ui.panel.locator}</dt><dd>{evidence.locator}</dd></div>
      </dl>
      <div><p className="sheet-label">{ui.panel.quote}</p><blockquote className="sheet-evidence-quote">{evidence.quote}</blockquote></div>
      {evidence.rulings.map((ruling, rulingIndex) => <dl className="sheet-ruling sheet-facts" key={rulingIndex}>
        <div><dt>{ui.panel.ruling}</dt><dd>{ruling.text}</dd></div>
        <div><dt>{ui.panel.ruler}</dt><dd>{ruling.ruler}</dd></div>
      </dl>)}
      {evidence.link_strength !== null ? <div className="sheet-link-strength"><p>{ui.link_strength[evidence.link_strength]}</p><p>{ui.link_strength.note}</p></div> : null}
      {evidence.url !== null ? <Button variant="primary" size="lg" asChild><a href={evidence.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{ui.panel.open_source}<Icon icon={LinkSquare02Icon} /></a></Button> : null}
    </article>)}
  </section>;
}
export function SourceSheet({ records, ui, term, onClose }: SourceSheetProps) {
  const [showEvidence, setShowEvidence] = useState(!term);
  return <BottomSheet title={term ?? ui.panel.title} ui={ui} onClose={onClose} term={Boolean(term)}>
    {term ? <div className="term-definition"><p>{records[0]?.claim}</p><Button variant="pill" aria-expanded={showEvidence} aria-controls="term-evidence" onClick={() => setShowEvidence((value) => !value)}><Icon icon={BookOpen01Icon} />{ui.panel.source}</Button></div> : null}
    {showEvidence ? <div id={term ? "term-evidence" : undefined}>
      {records.map((record, index) => index === 0 ? <RecordContent key={record.id} record={record} ui={ui} /> : <details key={record.id} className="sheet-more-record">
        <summary><span className="sheet-record-preview">{record.claim}</span><span className="detail-plus"><Icon icon={PlusSignIcon} /></span><span className="detail-minus"><Icon icon={MinusSignIcon} /></span></summary>
        <RecordContent record={record} ui={ui} />
      </details>)}
    </div> : null}
  </BottomSheet>;
}
