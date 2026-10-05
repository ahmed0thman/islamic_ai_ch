"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AskedQuestion } from "@/lib/asked";
import type { AskResponse } from "@/lib/ask/types";
import type { Depth } from "@/lib/types";
import { composedView } from "@/lib/ask-composed-view";
import { blockRole, displaySegments } from "@/lib/ask-client";
import { requestWeave, weaveQuestions } from "@/lib/weave-client";
import { Button } from "@/components/ui/button";
import { AskOrb } from "./ask-orb";
import { ParagraphView } from "./paragraph-view";
import { useReading } from "./reading-context";
import styles from "./weave-card.module.css";

export function WeaveCard({ surah, depth, stop, questions, onBack }: {
  surah: number; depth: Depth; stop: number; questions: AskedQuestion[]; onBack: () => void;
}) {
  const { relations: _relations, ...reading } = useReading();
  const { ui } = reading;
  const id = useId();
  const [result, setResult] = useState<AskResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const card = useRef<HTMLElement>(null);
  useEffect(() => () => { active.current?.abort(); clearTimeout(messageTimer.current); }, []);
  useEffect(() => { if (result) card.current?.focus({ preventScroll: true }); }, [result]);

  async function open() {
    if (active.current) return;
    clearTimeout(messageTimer.current);
    setFailed(false);
    setPending(true);
    const controller = new AbortController();
    active.current = controller;
    const woven = await requestWeave({ surah, depth, stop, questions: weaveQuestions(questions, depth, stop) }, controller.signal);
    if (controller.signal.aborted) return;
    active.current = null;
    setPending(false);
    if (woven) setResult(woven);
    else {
      setFailed(true);
      messageTimer.current = setTimeout(() => setFailed(false), 5_000);
    }
  }

  const items = result ? composedView(result) : null;
  return <div className={styles.slot} dir="rtl">
    {!result ? <Button variant="quiet" className={styles.trigger} onClick={open} disabled={pending} aria-expanded={false} aria-controls={id}>{ui.weave.trigger}</Button> : null}
    {pending ? <p className="ask-loading" role="status"><AskOrb size="sm" state="thinking" />{ui.ask.loading}</p> : null}
    {failed ? <p className={styles.failed} role="status">{ui.weave.failed}</p> : null}
    <section id={id} ref={card} tabIndex={-1} className={styles.card} aria-label={ui.weave.badge} hidden={!items}>
      {items ? <>
      <span className={styles.badge}>{ui.weave.badge}</span>
      <p className={styles.ready} role="status">{ui.weave.ready}</p>
      <p className="ask-composed-note">{ui.weave.note}</p>
      {items.map((item, index) => item.kind === "written" ? <div className="ask-composed" key={index}>
        <div className="ask-written"><ParagraphView block={{ type: "paragraph", role: "claim", segments: [{ t: "text", v: item.text }, { t: "mark", records: item.records }] }} mode="flow" runPrefix={`weave:${surah}:${depth}:${stop}:${index}`} {...reading} /></div>
        <details className="ask-verified">
          <summary><span className="ask-verified-open">{ui.ask.show_verified}</span><span className="ask-verified-close">{ui.ask.hide_verified}</span></summary>
          <div className="ask-verified-body">{item.atoms.map((atom) => <div className="ask-atom" key={atom.id}>
            <ParagraphView block={{ type: "paragraph", role: blockRole(atom), segments: displaySegments(atom) }} mode="flow" runPrefix={`weave-atom:${id}:${index}:${atom.id}`} {...reading} />
          </div>)}</div>
        </details>
      </div> : null)}
      <Button variant="quiet" className={styles.back} onClick={() => { setResult(null); onBack(); }}>{ui.weave.back}</Button>
      </> : null}
    </section>
  </div>;
}
