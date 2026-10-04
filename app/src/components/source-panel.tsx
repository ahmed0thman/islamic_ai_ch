"use client";

import { useEffect, useRef } from "react";
import type { SourceRecord, Ui } from "@/lib/types";
import { Badge, Icon } from "./marks";

export function SourcePanel({ records, ui, onClose }: { records: SourceRecord[]; ui: Ui; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const previousStyle = document.body.getAttribute("style");
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    element.showModal(); // Native modal makes the rest of the page inert.
    close.current?.focus();
    return () => {
      element.close();
      if (previousStyle === null) document.body.removeAttribute("style");
      else document.body.setAttribute("style", previousStyle);
      window.scrollTo(0, scrollY);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialog} className="source-panel" aria-labelledby="source-panel-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="panel-shell">
      <header className="panel-header">
        <h2 id="source-panel-title">{ui.panel.title}</h2>
        <button ref={close} type="button" className="quiet-button" onClick={onClose}>{ui.panel.close}<span aria-hidden="true"> ×</span></button>
      </header>
      <div className="panel-scroll">
        {records.map((record) => <section key={record.id} className="source-record" aria-labelledby={`claim-${record.id}`}>
          <p className="eyebrow">{ui.panel.claim}</p>
          <h3 id={`claim-${record.id}`}>{record.claim}</h3>
          <div className="record-status">
            {record.badge ? <Badge kind={record.badge} ui={ui} /> : <span className="no-badge">{ui.panel.no_badge}</span>}
            {record.status_text ? <p>{record.status_text}</p> : null}
          </div>
          <div className="evidence-list">
            {record.evidence.map((evidence, i) => <article className="evidence" key={i}>
              <header className="evidence-heading"><Icon kind={evidence.icon} ui={ui} /><span>{ui.icons[evidence.icon].label}</span></header>
              <dl className="source-facts">
                <div><dt>{ui.panel.source}</dt><dd>{evidence.source_title}</dd></div>
                <div><dt>{ui.panel.author}</dt><dd>{evidence.author}</dd></div>
                <div><dt>{ui.panel.locator}</dt><dd>{evidence.locator}</dd></div>
              </dl>
              <p className="eyebrow">{ui.panel.quote}</p>
              <blockquote className={evidence.icon === "ayah" ? "evidence-quote quran" : "evidence-quote"}>{evidence.quote}</blockquote>
              {evidence.rulings.map((ruling, r) => <dl className="ruling source-facts" key={r}>
                <div><dt>{ui.panel.ruling}</dt><dd>{ruling.text}</dd></div>
                <div><dt>{ui.panel.ruler}</dt><dd>{ruling.ruler}</dd></div>
                <div><dt>{ui.panel.locator}</dt><dd>{ruling.where}</dd></div>
              </dl>)}
              {evidence.link_strength !== null ? <div className="link-strength">
                <p>{ui.link_strength[evidence.link_strength]}</p><p className="muted">{ui.link_strength.note}</p>
              </div> : null}
              {evidence.url ? <a className="source-link" href={evidence.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{ui.panel.open_source}<span aria-hidden="true"> ↗</span></a> : null}
            </article>)}
          </div>
        </section>)}
      </div>
    </div>
  </dialog>;
}
